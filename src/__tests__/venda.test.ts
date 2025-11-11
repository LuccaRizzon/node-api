import request from "supertest";
import { app } from "../app";

const requestApp = request(app as any);
import { AppDataSource } from "../data-source";
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
    await AppDataSource.manager.delete(Venda, {});
  });

  afterAll(async () => {
    await clearTestData();
  });

  describe("POST /vendas - Criar Venda", () => {
    it("deve criar uma venda com sucesso", async () => {
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

    it("deve criar uma venda com desconto", async () => {
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

    it("deve criar uma venda com múltiplos itens", async () => {
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

    it("deve retornar erro 400 quando codigo está faltando", async () => {
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

    it("deve retornar erro 400 quando nomeCliente está faltando", async () => {
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

    it("deve retornar erro 400 quando itens está faltando", async () => {
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

    it("deve retornar erro 400 quando itens é um array vazio", async () => {
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

    it("deve retornar erro 400 quando produto não existe", async () => {
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

    it("deve listar todas as vendas", async () => {
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

    it("deve listar vendas com paginação", async () => {
      const response = await requestApp
        .get("/vendas?page=1&limit=2")
        .expect(200);

      expect(response.body.vendas.length).toBeLessThanOrEqual(2);
      expect(response.body.paginacao.page).toBe(1);
      expect(response.body.paginacao.limit).toBe(2);
    });

    it("deve listar vendas com filtro de data", async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      const response = await requestApp
        .get(`/vendas?dataInicio=${hoje}&dataFim=${amanha}`)
        .expect(200);

      expect(response.body).toHaveProperty("vendas");
      expect(response.body).toHaveProperty("totalizadores");
    });

    it("deve retornar totalizadores corretos", async () => {
      const response = await requestApp
        .get("/vendas")
        .expect(200);

      expect(response.body.totalizadores).toHaveProperty("valorTotal");
      expect(response.body.totalizadores).toHaveProperty("numeroVendas");
      expect(response.body.totalizadores).toHaveProperty("quantidadeItens");
      expect(response.body.totalizadores.numeroVendas).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GET /vendas/:id - Buscar Venda por ID", () => {
    let vendaCriada: Venda;

    beforeEach(async () => {
      vendaCriada = await createTestSale("VND-GET-001", "Cliente Get", produtoTeste.id);
    });

    it("deve buscar uma venda existente", async () => {
      const response = await requestApp
        .get(`/vendas/${vendaCriada.id}`)
        .expect(200);

      expect(response.body.id).toBe(vendaCriada.id);
      expect(response.body.codigo).toBe(vendaCriada.codigo);
      expect(response.body.nomeCliente).toBe(vendaCriada.nomeCliente);
      expect(response.body.itens).toBeDefined();
      expect(response.body.itens.length).toBeGreaterThan(0);
    });

    it("deve retornar erro 404 quando venda não existe", async () => {
      const response = await requestApp
        .get("/vendas/99999")
        .expect(404);

      expect(response.body).toHaveProperty("error", "Sale not found");
    });

    it("deve retornar erro 400 quando ID é inválido", async () => {
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

    it("deve atualizar uma venda existente", async () => {
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

    it("deve atualizar o código da venda", async () => {
      const updateData = {
        codigo: "VND-UPD-001-NEW"
      };

      const response = await requestApp
        .put(`/vendas/${vendaCriada.id}`)
        .send(updateData)
        .expect(200);

      expect(response.body.codigo).toBe("VND-UPD-001-NEW");
    });

    it("deve atualizar os itens da venda", async () => {
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

    it("deve atualizar desconto da venda", async () => {
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

    it("deve retornar erro 404 quando venda não existe", async () => {
      const updateData = {
        nomeCliente: "Cliente Teste"
      };

      const response = await requestApp
        .put("/vendas/99999")
        .send(updateData)
        .expect(404);

      expect(response.body).toHaveProperty("error", "Sale not found");
    });

    it("deve retornar erro 400 quando produto não existe na atualização", async () => {
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
  });

  describe("DELETE /vendas/:id - Deletar Venda", () => {
    let vendaCriada: Venda;

    beforeEach(async () => {
      vendaCriada = await createTestSale("VND-DEL-001", "Cliente Delete", produtoTeste.id);
    });

    it("deve deletar uma venda existente", async () => {
      await requestApp
        .delete(`/vendas/${vendaCriada.id}`)
        .expect(204);

      const vendaDeletada = await AppDataSource.manager.findOne(Venda, {
        where: { id: vendaCriada.id }
      });

      expect(vendaDeletada).toBeNull();
    });

    it("deve retornar erro 404 quando venda não existe", async () => {
      const response = await requestApp
        .delete("/vendas/99999")
        .expect(404);

      expect(response.body).toHaveProperty("error", "Sale not found");
    });

    it("deve deletar os itens da venda em cascata", async () => {
      const venda = await createTestSale("VND-DEL-002", "Cliente Delete 2", produtoTeste.id);
      
      await requestApp
        .delete(`/vendas/${venda.id}`)
        .expect(204);

      const itens = await AppDataSource.manager.find(VendaItem, {
        where: { venda: { id: venda.id } }
      });

      expect(itens.length).toBe(0);
    });
  });
});

