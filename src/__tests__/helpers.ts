import { TestDataSource } from "./test-data-source";
import { Produto } from "../entity/Produto";
import { Venda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";
import { StatusVenda } from "../entity/Venda";
import { roundMoney, multiplyMoney } from "../utils/money";

export async function createTestProduct(nome: string = "Produto Teste", preco: number = 100.00): Promise<Produto> {
  const produto = new Produto();
  produto.nome = nome;
  produto.preco = roundMoney(preco);
  return await TestDataSource.manager.save(Produto, produto);
}

export async function createTestSale(
  codigo: string = "VND-001",
  nomeCliente: string = "Cliente Teste",
  produtoId?: number
): Promise<Venda> {
  let produto: Produto;
  
  if (produtoId) {
    produto = await TestDataSource.manager.findOne(Produto, { where: { id: produtoId } }) as Produto;
  } else {
    produto = await createTestProduct();
  }

  const venda = new Venda();
  venda.codigo = codigo;
  venda.nomeCliente = nomeCliente;
  venda.descontoVenda = roundMoney(0);
  venda.valorTotal = roundMoney(0);
  venda.status = StatusVenda.ABERTA;

  const vendaSalva = await TestDataSource.manager.save(Venda, venda);

  const vendaItem = new VendaItem();
  vendaItem.venda = vendaSalva;
  vendaItem.produto = produto;
  vendaItem.quantidade = 2;
  vendaItem.precoUnitario = produto.preco;
  vendaItem.descontoItem = roundMoney(0);
  vendaItem.valorTotal = multiplyMoney(vendaItem.precoUnitario, vendaItem.quantidade);

  await TestDataSource.manager.save(VendaItem, vendaItem);

  vendaSalva.valorTotal = vendaItem.valorTotal;
  await TestDataSource.manager.save(Venda, vendaSalva);

  return await TestDataSource.manager.findOne(Venda, {
    where: { id: vendaSalva.id },
    relations: ["itens", "itens.produto"]
  }) as Venda;
}

export async function clearTestData(): Promise<void> {
  await TestDataSource.manager.delete(VendaItem, {});
  await TestDataSource.manager.delete(Venda, {});
  await TestDataSource.manager.delete(Produto, {});
}

