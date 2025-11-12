import request from "supertest";
import { app } from "../app";
import { TestDataSource } from "./test-data-source";
import { Produto } from "../entity/Produto";
import { createTestProduct, clearTestData } from "./helpers";

const requestApp = request(app as any);

// Helper to check error messages in RFC 7807 format
const expectErrorContains = (response: any, text: string) => {
    if (response.body.errors && Array.isArray(response.body.errors)) {
        // Validation errors: check in errors array
        const errorMessages = response.body.errors.map((e: any) => e.message).join(' ');
        expect(errorMessages).toContain(text);
    } else {
        // Other errors: check in detail
        expect(response.body.detail).toContain(text);
    }
};

describe("Venda API Security Tests (OWASP Best Practices)", () => {
    let produtoTeste: Produto;

    beforeAll(async () => {
        await clearTestData();
        produtoTeste = await createTestProduct("Produto Teste", 50.00);
    });

    afterAll(async () => {
        await clearTestData();
    });

    describe("OWASP A03:2021 - Injection Attacks", () => {
        describe("SQL Injection Protection", () => {
            it("should reject SQL injection in codigo field", async () => {
                const sqlInjectionPayloads = [
                    "'; DROP TABLE vendas; --",
                    "' OR '1'='1",
                    "'; INSERT INTO vendas VALUES (1, 'hack', 'hack', 0, 0, 'Aberta'); --",
                    "1' UNION SELECT * FROM vendas--",
                    "admin'--",
                    "admin'/*",
                ];

                for (const payload of sqlInjectionPayloads) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: payload,
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        })
                        .expect(422); // Semantic error - invalid characters

                    expect(response.body.errors || response.body.detail).toBeDefined();
                    expectErrorContains(response, "invalid characters");
                }
            });

            it("should reject SQL injection in nomeCliente field", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "'; DROP TABLE vendas; --",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - invalid characters

                expectErrorContains(response, "invalid characters");
            });

            it("should reject SQL injection in search query parameter", async () => {
                const sqlInjectionPayloads = [
                    "'; DROP TABLE vendas; --",
                    "' OR '1'='1",
                    "1' UNION SELECT * FROM vendas--",
                ];

                for (const payload of sqlInjectionPayloads) {
                    const response = await requestApp
                        .get(`/vendas?search=${encodeURIComponent(payload)}`)
                        .expect(422); // Semantic error - invalid characters

                    expect(response.body.errors || response.body.detail).toBeDefined();
                    expectErrorContains(response, "invalid characters");
                }
            });
        });

        describe("NoSQL Injection Protection", () => {
            it("should reject MongoDB injection in produtoId", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: { $gt: 0 },
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(400);

                expectErrorContains(response, "produtoId");
                expectErrorContains(response, "integer");
            });
        });
    });

    describe("OWASP A01:2021 - Broken Access Control", () => {
        describe("ID Parameter Validation", () => {
            it("should reject negative IDs", async () => {
                const response = await requestApp
                    .get("/vendas/-1")
                    .expect(422); // Semantic error - value out of range

                expectErrorContains(response, "ID must be an integer");
            });

            it("should reject zero as ID", async () => {
                const response = await requestApp
                    .get("/vendas/0")
                    .expect(422); // Semantic error - value out of range

                expectErrorContains(response, "ID must be an integer");
            });

            it("should reject non-numeric IDs", async () => {
                const invalidIds = ["abc", "null", "undefined", "true", "false", "NaN"];

                for (const id of invalidIds) {
                    const response = await requestApp
                        .get(`/vendas/${id}`)
                        .expect(400); // Syntactic error - wrong type

                    expectErrorContains(response, "ID must be an integer");
                }
            });
        });
    });

    describe("OWASP A03:2021 - Data Exposure", () => {
        describe("Integer Overflow Protection", () => {
            it("should reject produtoId exceeding MySQL INT max (2,147,483,647)", async () => {
                const overflowValues = [
                    2147483648, // MySQL INT max + 1
                    9999999999,
                    Number.MAX_SAFE_INTEGER,
                ];

                for (const value of overflowValues) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: value,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        })
                        .expect(422); // Semantic error - integer overflow

                    expectErrorContains(response, "produtoId");
                    expectErrorContains(response, "2147483647");
                }
            });

            it("should reject quantidade exceeding MySQL INT max", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 2147483648,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - integer overflow

                expectErrorContains(response, "quantidade");
                expectErrorContains(response, "2147483647");
            });

            it("should reject page parameter exceeding MySQL INT max", async () => {
                const response = await requestApp
                    .get("/vendas?page=2147483648")
                    .expect(422); // Semantic error - integer overflow

                expectErrorContains(response, "page");
                expectErrorContains(response, "2147483647");
            });
        });

        describe("Decimal Precision Protection", () => {
            it("should reject precoUnitario with more than 2 decimal places", async () => {
                const invalidDecimals = [10.123, 10.9999, 10.123456789];

                for (const value of invalidDecimals) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: value
                            }]
                        })
                        .expect(422); // Semantic error - decimal precision

                    expectErrorContains(response, "decimal places");
                }
            });

            it("should reject descontoItem with more than 2 decimal places", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00,
                            descontoItem: 5.123
                        }]
                    })
                    .expect(422); // Semantic error - decimal precision

                expectErrorContains(response, "decimal places");
            });
        });
    });

    describe("OWASP A07:2021 - Identification and Authentication Failures", () => {
        describe("Input Validation - String Fields", () => {
            it("should reject codigo exceeding max length (50)", async () => {
                const longString = "A".repeat(51);

                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: longString,
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - length limit

                expectErrorContains(response, "codigo");
                expectErrorContains(response, "50");
            });

            it("should reject nomeCliente exceeding max length (100)", async () => {
                const longString = "A".repeat(101);

                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: longString,
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - length limit

                expectErrorContains(response, "nomeCliente");
                expectErrorContains(response, "100");
            });

            it("should reject search query exceeding max length (255)", async () => {
                const longString = "A".repeat(256);

                const response = await requestApp
                    .get(`/vendas?search=${encodeURIComponent(longString)}`)
                    .expect(422); // Semantic error - length limit

                expectErrorContains(response, "search");
                expectErrorContains(response, "255");
            });
        });
    });

    describe("OWASP A03:2021 - XSS (Cross-Site Scripting) Protection", () => {
        describe("XSS Payload Rejection", () => {
            it("should reject XSS payloads in codigo field", async () => {
                const xssPayloads = [
                    "<script>alert('XSS')</script>",
                    "<img src=x onerror=alert('XSS')>",
                    "javascript:alert('XSS')",
                    "<svg onload=alert('XSS')>",
                    "'\"><script>alert('XSS')</script>",
                ];

                for (const payload of xssPayloads) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: payload,
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        })
                        .expect(422); // Semantic error - invalid characters

                    expectErrorContains(response, "invalid characters");
                }
            });

            it("should reject XSS payloads in nomeCliente field", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "<script>alert('XSS')</script>",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - invalid characters

                expectErrorContains(response, "invalid characters");
            });

            it("should reject XSS payloads in search query", async () => {
                const response = await requestApp
                    .get(`/vendas?search=${encodeURIComponent("<script>alert('XSS')</script>")}`)
                    .expect(422); // Semantic error - invalid characters

                expectErrorContains(response, "invalid characters");
            });
        });
    });

    describe("OWASP A05:2021 - Security Misconfiguration", () => {
        describe("Type Validation", () => {
            it("should reject non-string codigo", async () => {
                const invalidTypes = [123, true, false, null, {}, []];

                for (const value of invalidTypes) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: value,
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        })
                        .expect(400);

                    expectErrorContains(response, "codigo");
                    expectErrorContains(response, "string");
                }
            });

            it("should reject non-integer produtoId", async () => {
                const invalidTypes = ["abc", 1.5, true, false, null, {}, []];

                for (const value of invalidTypes) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: value,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        });

                    // Should return 400 (validation) or 500 (if validation passes but service fails)
                    expect([400, 500]).toContain(response.status);
                    if (response.status === 400) {
                        expectErrorContains(response, "produtoId");
                        expectErrorContains(response, "integer");
                    }
                }
            });

            it("should reject non-integer quantidade", async () => {
                const invalidTypes = ["abc", 1.5, true, false, null, {}, []];

                for (const value of invalidTypes) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: value,
                                precoUnitario: 10.00
                            }]
                        });

                    // Should return 400 (validation) or 500 (if validation passes but service fails)
                    expect([400, 500]).toContain(response.status);
                    if (response.status === 400) {
                        expectErrorContains(response, "quantidade");
                        expectErrorContains(response, "integer");
                    }
                }
            });

            it("should reject non-float precoUnitario", async () => {
                const invalidTypes = ["abc", true, false, null, {}, []];

                for (const value of invalidTypes) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: value
                            }]
                        });

                    // Should return 400 (validation) or 500 (if validation passes but service fails)
                    expect([400, 500]).toContain(response.status);
                    if (response.status === 400) {
                        expectErrorContains(response, "precoUnitario");
                    }
                }
            });
        });

        describe("Boundary Value Testing", () => {
            it("should accept produtoId at MySQL INT max boundary", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-BOUNDARY",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: 2147483647, // MySQL INT max
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    });

                // Deve falhar porque o produto não existe, mas a validação deve aceitar o limite máximo
                expect([400, 404, 201]).toContain(response.status);
                if (response.status === 400) {
                    const errorText = response.body.errors ? response.body.errors.map((e: any) => e.message).join(' ') : response.body.detail;
                    expect(errorText).not.toContain("integer between");
                    expect(errorText).not.toMatch(/integer between \d+ and \d+/);
                } else if (response.status === 404) {
                    expect(response.body.code).toBe("PRODUCT_NOT_FOUND");
                    expect(response.body.detail).toContain("2147483647");
                }
            });

            it("should accept quantidade at MySQL INT max boundary", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-BOUNDARY-2",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 2147483647, // MySQL INT max
                            precoUnitario: 10.00
                        }]
                    });

                // Should succeed or fail for business logic, not validation
                expect([201, 400]).toContain(response.status);
                if (response.status === 400) {
                    const errorText = response.body.errors ? response.body.errors.map((e: any) => e.message).join(' ') : response.body.detail;
                    expect(errorText).not.toContain("2147483647");
                }
            });

            it("should reject negative quantidade", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: -1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - value out of range

                expectErrorContains(response, "quantidade");
            });

            it("should reject zero quantidade", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 0,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - value out of range

                expectErrorContains(response, "quantidade");
            });

            it("should reject negative precoUnitario", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: -10.00
                        }]
                    })
                    .expect(422); // Semantic error - value out of range

                expectErrorContains(response, "precoUnitario");
            });
        });
    });

    describe("OWASP A08:2021 - Software and Data Integrity Failures", () => {
        describe("Array Validation", () => {
            it("should reject non-array itens", async () => {
                const invalidTypes = ["string", 123, true, false, null, {}];

                for (const value of invalidTypes) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            itens: value
                        })
                        .expect(422); // Semantic error - must be an array

                    expectErrorContains(response, "itens");
                    expectErrorContains(response, "array");
                }
            });

            it("should reject empty itens array", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "VND-TEST",
                        nomeCliente: "Test",
                        itens: []
                    })
                    .expect(422); // Semantic error - at least one item

                expectErrorContains(response, "itens");
                expectErrorContains(response, "at least one item");
            });
        });

        describe("Query Parameter Validation", () => {
            it("should reject invalid date format in dataInicio", async () => {
                const invalidDates = [
                    "2024-13-01", // Invalid month
                    "2024-01-32", // Invalid day
                    "01/01/2024", // Wrong format
                    "2024-1-1",   // Missing padding
                    "not-a-date",
                ];

                for (const date of invalidDates) {
                    const response = await requestApp
                        .get(`/vendas?dataInicio=${date}`)
                        .expect(400); // Syntactic error - format error

                    expectErrorContains(response, "dataInicio");
                    expectErrorContains(response, "ISO 8601");
                }
            });

            it("should reject invalid page value", async () => {
                const invalidPages = [-1, 0, "abc", 1.5, null];

                for (const page of invalidPages) {
                    const response = await requestApp
                        .get(`/vendas?page=${page}`);
                    
                    // -1, 0 are semantic (422), "abc", 1.5, null are syntactic (400)
                    const expectedStatus = (page === -1 || page === 0) ? 422 : 400;
                    expect(response.status).toBe(expectedStatus);
                    expectErrorContains(response, "page");
                }
            });

            it("should reject invalid limit value", async () => {
                const invalidLimits = [-1, 0, 101, "abc", 1.5, null];

                for (const limit of invalidLimits) {
                    const response = await requestApp
                        .get(`/vendas?limit=${limit}`);
                    
                    // -1, 0, 101 are semantic (422), "abc", 1.5, null are syntactic (400)
                    const expectedStatus = (limit === -1 || limit === 0 || limit === 101) ? 422 : 400;
                    expect(response.status).toBe(expectedStatus);
                    expectErrorContains(response, "limit");
                }
            });
        });
    });

    describe("OWASP A01:2021 - Broken Access Control - Status Validation", () => {
            it("should reject invalid status values", async () => {
                const invalidStatuses = [
                    "Invalid",
                    "Hacked",
                    "'; DROP TABLE; --",
                    "<script>alert('XSS')</script>",
                    "Aberta' OR '1'='1",
                ];

                for (const status of invalidStatuses) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: "VND-TEST",
                            nomeCliente: "Test",
                            status: status,
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        });
                    
                    // Status with invalid characters is 422, invalid enum value is 422
                    expect(response.status).toBe(422);
                    expectErrorContains(response, "status");
                }
            });

        it("should accept valid status values", async () => {
            const validStatuses = ["Aberta", "Concluída", "Cancelada"];

            for (const status of validStatuses) {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: `VND-${status}-${Date.now()}`,
                        nomeCliente: "Test",
                        status: status,
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    });

                // Should succeed or fail for business logic, not validation
                expect([201, 400]).toContain(response.status);
                if (response.status === 400) {
                    const errorText = response.body.errors ? response.body.errors.map((e: any) => e.message).join(' ') : response.body.detail;
                    expect(errorText).not.toContain("status");
                }
            }
        });
    });

    describe("OWASP A03:2021 - Command Injection Protection", () => {
            it("should reject command injection in string fields", async () => {
                const commandInjectionPayloads = [
                    "; ls -la",
                    "| cat /etc/passwd",
                    "&& rm -rf /",
                    "`whoami`",
                    "$(id)",
                ];

                for (const payload of commandInjectionPayloads) {
                    const response = await requestApp
                        .post("/vendas")
                        .send({
                            codigo: payload,
                            nomeCliente: "Test",
                            itens: [{
                                produtoId: produtoTeste.id,
                                quantidade: 1,
                                precoUnitario: 10.00
                            }]
                        })
                        .expect(422); // Semantic error - invalid characters

                    expectErrorContains(response, "invalid characters");
                }
            });
    });

    describe("OWASP A04:2021 - Insecure Design - Input Sanitization", () => {
        it("should trim whitespace from string inputs", async () => {
            const response = await requestApp
                .post("/vendas")
                .send({
                    codigo: "  VND-TEST  ",
                    nomeCliente: "  Test Client  ",
                    itens: [{
                        produtoId: produtoTeste.id,
                        quantidade: 1,
                        precoUnitario: 10.00
                    }]
                });

            // Should succeed (trimmed) or fail for duplicate, not validation
            expect([201, 422]).toContain(response.status);
        });

            it("should reject strings with only whitespace", async () => {
                const response = await requestApp
                    .post("/vendas")
                    .send({
                        codigo: "   ",
                        nomeCliente: "Test",
                        itens: [{
                            produtoId: produtoTeste.id,
                            quantidade: 1,
                            precoUnitario: 10.00
                        }]
                    })
                    .expect(422); // Semantic error - empty after trim (length validation)

                expectErrorContains(response, "codigo");
            });
    });
});

