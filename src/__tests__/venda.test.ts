import request from "supertest";
import { app } from "../app";

const requestApp = request(app as any);
import { TestDataSource } from "./test-data-source";
import { Produto } from "../entity/Produto";
import { Venda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";
import { StatusVenda } from "../entity/Venda";
import { createTestProduct, createTestSale, clearTestData } from "./helpers";

describe("Venda API Endpoints", () => {
  let produtoTeste: Produto;

  beforeAll(async () => {
    await clearTestData();
    produtoTeste = await createTestProduct("Produto Teste", 50.00);
  });

  afterEach(async () => {
    await TestDataSource.manager.delete(Venda, {});
  });

  afterAll(async () => {
    await clearTestData();
  });

  describe("POST /vendas - Criar Venda", () => {
    it("should create a sale successfully", async () => {
      const vendaData = {
        codigo: "VND-001",
        nomeCliente: "João Silva",
        descontoVenda: 0,
        itens: [
          {
            produtoId: produtoTeste.id,
            quantidade: 2,
            precoUnitario: 50.00,
            descontoItem: 0
          }
        ],
        status: StatusVenda.ABERTA
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body.codigo).toBe(vendaData.codigo);
      expect(response.body.nomeCliente).toBe(vendaData.nomeCliente);
      expect(response.body.status).toBe(StatusVenda.ABERTA);
      expect(response.body.itens).toHaveLength(1);
      expect(parseFloat(response.body.valorTotal)).toBe(100.00);
    });

    it("should create a sale with discount", async () => {
      const vendaData = {
        codigo: "VND-002",
        nomeCliente: "Maria Santos",
        descontoVenda: 10.00,
        itens: [
          {
            produtoId: produtoTeste.id,
            quantidade: 2,
            precoUnitario: 50.00,
            descontoItem: 0
          }
        ]
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(201);

      expect(parseFloat(response.body.valorTotal)).toBe(90.00);
      expect(parseFloat(response.body.descontoVenda)).toBe(10.00);
    });

    it("should create a sale with multiple items", async () => {
      const produto2 = await createTestProduct("Produto 2", 30.00);
      
      const vendaData = {
        codigo: "VND-003",
        nomeCliente: "Pedro Costa",
        itens: [
          {
            produtoId: produtoTeste.id,
            quantidade: 2,
            precoUnitario: 50.00
          },
          {
            produtoId: produto2.id,
            quantidade: 3,
            precoUnitario: 30.00
          }
        ]
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(201);

      expect(response.body.itens).toHaveLength(2);
      expect(parseFloat(response.body.valorTotal)).toBe(190.00);
    });

    it("should return error 400 when codigo is missing", async () => {
      const vendaData = {
        nomeCliente: "João Silva",
        itens: [
          {
            produtoId: produtoTeste.id,
            quantidade: 2,
            precoUnitario: 50.00
          }
        ]
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(400);

      expect(response.body.error).toContain("codigo");
    });

    it("should return error 400 when nomeCliente is missing", async () => {
      const vendaData = {
        codigo: "VND-004",
        itens: [
          {
            produtoId: produtoTeste.id,
            quantidade: 2,
            precoUnitario: 50.00
          }
        ]
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(400);

      expect(response.body.error).toContain("nomeCliente");
      expect(response.body.error).toContain("required");
    });

    it("should return error 400 when itens is missing", async () => {
      const vendaData = {
        codigo: "VND-005",
        nomeCliente: "João Silva"
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(400);

      expect(response.body.error).toContain("itens");
      expect(response.body.error).toContain("required");
    });

    it("should return error 400 when itens is an empty array", async () => {
      const vendaData = {
        codigo: "VND-006",
        nomeCliente: "João Silva",
        itens: []
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(400);

      expect(response.body.error).toContain("itens");
      expect(response.body.error).toContain("at least one item");
    });

    it("should return error 400 when product does not exist", async () => {
      const vendaData = {
        codigo: "VND-007",
        nomeCliente: "João Silva",
        itens: [
          {
            produtoId: 99999,
            quantidade: 2,
            precoUnitario: 50.00
          }
        ]
      };

      const response = await requestApp
        .post("/vendas")
        .send(vendaData)
        .expect(400);

      expect(response.body.error).toContain("not found");
    });
  });

  describe("GET /vendas - Listar Vendas", () => {
    beforeEach(async () => {
      await createTestSale("VND-LIST-001", "Cliente 1", produtoTeste.id);
      await createTestSale("VND-LIST-002", "Cliente 2", produtoTeste.id);
      await createTestSale("VND-LIST-003", "Cliente 3", produtoTeste.id);
    });

    it("should list all sales", async () => {
      const response = await requestApp
        .get("/vendas")
        .expect(200);

      expect(response.body).toHaveProperty("vendas");
      expect(response.body).toHaveProperty("paginacao");
      expect(response.body).toHaveProperty("totalizadores");
      expect(response.body.vendas.length).toBeGreaterThanOrEqual(3);
      expect(response.body.paginacao.page).toBe(1);
      expect(response.body.paginacao.limit).toBe(10);
    });

    it("should list sales with pagination", async () => {
      const response = await requestApp
        .get("/vendas?page=1&limit=2")
        .expect(200);

      expect(response.body.vendas.length).toBeLessThanOrEqual(2);
      expect(response.body.paginacao.page).toBe(1);
      expect(response.body.paginacao.limit).toBe(2);
    });

    it("should list sales with data filter", async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const response = await requestApp
        .get(`/vendas?dataInicio=${hoje}&dataFim=${amanha}`)
        .expect(200);

      expect(response.body).toHaveProperty("vendas");
      expect(response.body).toHaveProperty("totalizadores");
    });

    it("should return correct totals", async () => {
      const response = await requestApp
        .get("/vendas")
        .expect(200);

      expect(response.body.totalizadores).toHaveProperty("valorTotal");
      expect(response.body.totalizadores).toHaveProperty("numeroVendas");
      expect(response.body.totalizadores).toHaveProperty("quantidadeItens");
      expect(response.body.totalizadores.numeroVendas).toBeGreaterThanOrEqual(3);
    });

    it("should search sales by codigo", async () => {
      const response = await requestApp
        .get("/vendas?search=VND-LIST-001")
        .expect(200);

      expect(response.body.vendas.length).toBeGreaterThanOrEqual(1);
      expect(response.body.vendas.some((v: any) => v.codigo === "VND-LIST-001")).toBe(true);
    });

    it("should search sales by nomeCliente", async () => {
      const response = await requestApp
        .get("/vendas?search=Cliente 1")
        .expect(200);

      expect(response.body.vendas.length).toBeGreaterThanOrEqual(1);
      expect(response.body.vendas.some((v: any) => v.nomeCliente === "Cliente 1")).toBe(true);
    });

    it("should search sales by status", async () => {
      const response = await requestApp
        .get("/vendas?search=Aberta")
        .expect(200);

      expect(response.body.vendas.length).toBeGreaterThanOrEqual(1);
      expect(response.body.vendas.every((v: any) => v.status === StatusVenda.ABERTA)).toBe(true);
    });

    it("should perform case-insensitive search", async () => {
      const response = await requestApp
        .get("/vendas?search=cliente")
        .expect(200);

      expect(response.body.vendas.length).toBeGreaterThanOrEqual(3);
    });

    it("should combine search with date filters", async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const response = await requestApp
        .get(`/vendas?dataInicio=${hoje}&dataFim=${amanha}&search=Cliente`)
        .expect(200);

      expect(response.body).toHaveProperty("vendas");
      expect(response.body.vendas.length).toBeGreaterThanOrEqual(0);
    });

    it("should return empty results for non-matching search", async () => {
      const response = await requestApp
        .get("/vendas?search=NonExistentCode12345")
        .expect(200);

      expect(response.body.vendas.length).toBe(0);
      expect(response.body.totalizadores.numeroVendas).toBe(0);
    });
  });

  describe("GET /vendas/:id - Buscar Venda por ID", () => {
    let vendaCriada: Venda;

    beforeEach(async () => {
      vendaCriada = await createTestSale("VND-GET-001", "Cliente Get", produtoTeste.id);
    });

    it("should find an existing sale", async () => {
      const response = await requestApp
        .get(`/vendas/${vendaCriada.id}`)
        .expect(200);

      expect(response.body.id).toBe(vendaCriada.id);
      expect(response.body.codigo).toBe(vendaCriada.codigo);
      expect(response.body.nomeCliente).toBe(vendaCriada.nomeCliente);
      expect(response.body.itens).toBeDefined();
      expect(response.body.itens.length).toBeGreaterThan(0);
    });

    it("should return error 404 when sale does not exist", async () => {
      const response = await requestApp
        .get("/vendas/99999")
        .expect(404);

      expect(response.body).toHaveProperty("error", "Sale not found");
    });

    it("should return error 400 when ID is invalid", async () => {
      const response = await requestApp
        .get("/vendas/abc")
        .expect(400);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("PUT /vendas/:id - Atualizar Venda", () => {
    let vendaCriada: Venda;

    beforeEach(async () => {
      vendaCriada = await createTestSale("VND-UPD-001", "Cliente Update", produtoTeste.id);
    });

    it("should update an existing sale", async () => {
      const updateData = {
        nomeCliente: "Cliente Atualizado",
        status: StatusVenda.CONCLUIDA
      };

      const response = await requestApp
        .put(`/vendas/${vendaCriada.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.nomeCliente).toBe("Cliente Atualizado");
      expect(response.body.status).toBe(StatusVenda.CONCLUIDA);
      expect(response.body.id).toBe(vendaCriada.id);
    });

    it("should update the sale code", async () => {
      const updateData = {
        codigo: "VND-UPD-001-NEW"
      };

      const response = await requestApp
        .put(`/vendas/${vendaCriada.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.codigo).toBe("VND-UPD-001-NEW");
    });

    it("should update the sale items", async () => {
      const produto2 = await createTestProduct("Produto Update", 75.00);
      
      const updateData = {
        itens: [
          {
            produtoId: produto2.id,
            quantidade: 3,
            precoUnitario: 75.00
          }
        ]
      };

      const response = await requestApp
        .put(`/vendas/${vendaCriada.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.itens).toHaveLength(1);
      expect(response.body.itens[0].produto.id).toBe(produto2.id);
      expect(parseFloat(response.body.valorTotal)).toBe(225.00);
    });

    it("should update the sale discount", async () => {
      const updateData = {
        descontoVenda: 20.00
      };

      const response = await requestApp
        .put(`/vendas/${vendaCriada.id}`)
        .send(updateData)
        .expect(200);

      expect(parseFloat(response.body.descontoVenda)).toBe(20.00);
      expect(parseFloat(response.body.valorTotal)).toBe(80.00);
    });

    it("should return error 404 when sale does not exist", async () => {
      const updateData = {
        nomeCliente: "Cliente Teste"
      };

      const response = await requestApp
        .put("/vendas/99999")
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty("error", "Sale not found");
    });

    it("should return error 400 when product does not exist in update", async () => {
      const updateData = {
        itens: [
          {
            produtoId: 99999,
            quantidade: 2,
            precoUnitario: 50.00
          }
        ]
      };

      const response = await requestApp
        .put(`/vendas/${vendaCriada.id}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error).toContain("Product");
    });

    it("should return error 422 when trying to update a concluded sale", async () => {
      // Create a concluded sale
      const vendaConcluida = await createTestSale("VND-CONCL-001", "Cliente Concluido", produtoTeste.id);
      vendaConcluida.status = StatusVenda.CONCLUIDA;
      await TestDataSource.manager.save(Venda, vendaConcluida);

      const updateData = {
        nomeCliente: "Cliente Atualizado"
      };

      const response = await requestApp
        .put(`/vendas/${vendaConcluida.id}`)
        .send(updateData)
        .expect(422);

      expect(response.body.error).toContain("Concluída");
      expect(response.body.error).toContain("finished status");
    });
  });

  describe("DELETE /vendas/:id - Deletar Venda", () => {
    let vendaCriada: Venda;

    beforeEach(async () => {
      vendaCriada = await createTestSale("VND-DEL-001", "Cliente Delete", produtoTeste.id);
    });

    it("should delete an existing sale", async () => {
      await requestApp
        .delete(`/vendas/${vendaCriada.id}`)
        .expect(204);

      const vendaDeletada = await TestDataSource.manager.findOne(Venda, {
        where: { id: vendaCriada.id }
      });

      expect(vendaDeletada).toBeNull();
    });

    it("should return error 404 when sale does not exist", async () => {
      const response = await requestApp
        .delete("/vendas/99999")
        .expect(404);

      expect(response.body).toHaveProperty("error", "Sale not found");
    });

    it("should delete the sale items in cascade", async () => {
      const venda = await createTestSale("VND-DEL-002", "Cliente Delete 2", produtoTeste.id);
      
      await requestApp
        .delete(`/vendas/${venda.id}`)
        .expect(204);

      const itens = await TestDataSource.manager.find(VendaItem, {
        where: { venda: { id: venda.id } }
      });

      expect(itens.length).toBe(0);
    });

    it("should return error 422 when trying to delete a concluded sale", async () => {
      // Create a concluded sale
      const vendaConcluida = await createTestSale("VND-DEL-CONCL-001", "Cliente Delete Concluido", produtoTeste.id);
      vendaConcluida.status = StatusVenda.CONCLUIDA;
      await TestDataSource.manager.save(Venda, vendaConcluida);

      const response = await requestApp
        .delete(`/vendas/${vendaConcluida.id}`)
        .expect(422);

      expect(response.body.error).toContain("Concluída");
      expect(response.body.error).toContain("finished status");

      // Verify the sale still exists
      const vendaAindaExiste = await TestDataSource.manager.findOne(Venda, {
        where: { id: vendaConcluida.id }
      });
      expect(vendaAindaExiste).not.toBeNull();
    });
  });
});

