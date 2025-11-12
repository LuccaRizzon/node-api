import { calculateSaleTotals } from "../service/saleCalculations";
import { addMoney, toBig, toMoneyString } from "../utils/money";

describe("Sale calculation precision", () => {
    it("distributes sale discount proportionally and preserves totals", () => {
        const result = calculateSaleTotals({
            descontoVenda: 10,
            itens: [
                { produtoId: 1, quantidade: 2, precoUnitario: 50 },
                { produtoId: 2, quantidade: 3, precoUnitario: 30 }
            ]
        });

        const itemTotals = result.itens.map((item) => item.valorTotal);
        const sumItemTotals = itemTotals.reduce((acc, cur) => addMoney(acc, cur), "0.00");

        expect(result.descontoVenda).toBe("10.00");
        expect(result.valorTotal).toBe("180.00");
        expect(sumItemTotals).toBe(result.valorTotal);
    });

    it("handles percentage-like discounts without float errors", () => {
        const result = calculateSaleTotals({
            descontoVenda: 5, // 5% de 100.00
            itens: [
                { produtoId: 1, quantidade: 1, precoUnitario: 100 }
            ]
        });

        expect(result.valorTotal).toBe("95.00");
        expect(result.itens[0].valorTotal).toBe("95.00");
    });

    it("rounds discount distribution to two decimals while preserving total sum", () => {
        const result = calculateSaleTotals({
            descontoVenda: 1,
            itens: [
                { produtoId: 1, quantidade: 1, precoUnitario: 0.33 },
                { produtoId: 2, quantidade: 1, precoUnitario: 0.33 },
                { produtoId: 3, quantidade: 1, precoUnitario: 0.34 }
            ]
        });

        const discountSum = result.itens
            .map((item) => item.descontoItem)
            .reduce((acc, cur) => addMoney(acc, cur), "0.00");

        const itemTotalSum = result.itens
            .map((item) => item.valorTotal)
            .reduce((acc, cur) => addMoney(acc, cur), "0.00");

        expect(discountSum).toBe(result.descontoVenda);
        expect(result.valorTotal).toBe("0.00");
        expect(itemTotalSum).toBe(result.valorTotal);

        result.itens.forEach((item) => {
            const rawTotal = toBig(item.precoUnitario).times(item.quantidade);
            const rawMinusDiscount = rawTotal.minus(toBig(item.descontoItem));
            expect(item.valorTotal).toBe(toMoneyString(rawMinusDiscount));
        });
    });
});


