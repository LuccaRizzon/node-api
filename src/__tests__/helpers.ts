import { AppDataSource } from "../data-source";
import { Produto } from "../entity/Produto";
import { Venda } from "../entity/Venda";
import { VendaItem } from "../entity/VendaItem";
import { StatusVenda } from "../entity/Venda";

export async function createTestProduct(nome: string = "Produto Teste", preco: number = 100.00): Promise<Produto> {
  const produto = new Produto();
  produto.nome = nome;
  produto.preco = preco;
  return await AppDataSource.manager.save(Produto, produto);
}

export async function createTestSale(
  codigo: string = "VND-001",
  nomeCliente: string = "Cliente Teste",
  produtoId?: number
): Promise<Venda> {
  let produto: Produto;
  
  if (produtoId) {
    produto = await AppDataSource.manager.findOne(Produto, { where: { id: produtoId } }) as Produto;
  } else {
    produto = await createTestProduct();
  }

  const venda = new Venda();
  venda.codigo = codigo;
  venda.nomeCliente = nomeCliente;
  venda.descontoVenda = 0;
  venda.valorTotal = 0;
  venda.status = StatusVenda.ABERTA;

  const vendaSalva = await AppDataSource.manager.save(Venda, venda);

  const vendaItem = new VendaItem();
  vendaItem.venda = vendaSalva;
  vendaItem.produto = produto;
  vendaItem.quantidade = 2;
  vendaItem.precoUnitario = produto.preco;
  vendaItem.descontoItem = 0;
  vendaItem.valorTotal = vendaItem.quantidade * vendaItem.precoUnitario;

  await AppDataSource.manager.save(VendaItem, vendaItem);

  vendaSalva.valorTotal = vendaItem.valorTotal;
  await AppDataSource.manager.save(Venda, vendaSalva);

  return await AppDataSource.manager.findOne(Venda, {
    where: { id: vendaSalva.id },
    relations: ["itens", "itens.produto"]
  }) as Venda;
}

export async function clearTestData(): Promise<void> {
  await AppDataSource.manager.delete(VendaItem, {});
  await AppDataSource.manager.delete(Venda, {});
  await AppDataSource.manager.delete(Produto, {});
}

