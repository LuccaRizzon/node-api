import Big from "big.js";
import {
    addMoney,
    multiplyMoney,
    subtractMoney,
    roundMoney,
    ZERO,
    toBigMoney,
    MoneyInput,
    isMoneyGreaterThan
} from "../utils/money";

export interface SaleItemInput {
    produtoId?: number;
    quantidade: number;
    precoUnitario: MoneyInput;
    descontoItem?: MoneyInput;
}

export interface CalculatedSaleItem {
    produtoId?: number;
    quantidade: number;
    precoUnitario: string;
    descontoItem: string;
    valorBruto: string;
    valorTotal: string;
}

export interface SaleCalculationRequest {
    descontoVenda?: MoneyInput;
    itens: SaleItemInput[];
}

export interface SaleCalculationResult {
    descontoVenda: string;
    valorTotal: string;
    itens: CalculatedSaleItem[];
    totalBruto: string;
}

const clampDiscount = (discount: string, maxDiscount: string): string => {
    if (isMoneyGreaterThan(discount, maxDiscount)) {
        return roundMoney(maxDiscount);
    }
    if (isMoneyGreaterThan(ZERO, discount)) {
        return ZERO;
    }
    return roundMoney(discount);
};

const calculateItemDiscounts = (
    grossTotals: Big[],
    saleDiscount: Big
): string[] => {
    const discounts: string[] = [];
    const totalGross = grossTotals.reduce((acc, current) => acc.plus(current), new Big(0));

    if (totalGross.eq(0)) {
        return grossTotals.map(() => ZERO);
    }

    let allocated = new Big(0);

    grossTotals.forEach((gross, index) => {
        let discountForItem: Big;

        if (index === grossTotals.length - 1) {
            discountForItem = saleDiscount.minus(allocated);
        } else {
            const proportion = gross.div(totalGross);
            discountForItem = saleDiscount.times(proportion).round(2, Big.roundHalfUp);
            allocated = allocated.plus(discountForItem);
        }

        if (discountForItem.lt(0)) {
            discountForItem = new Big(0);
        }

        discounts.push(roundMoney(discountForItem));
    });

    return discounts;
};

export const calculateSaleTotals = (input: SaleCalculationRequest): SaleCalculationResult => {
    const items: CalculatedSaleItem[] = input.itens.map((item) => {
        const precoUnitario = roundMoney(item.precoUnitario);
        const quantidade = item.quantidade;
        const valorBruto = multiplyMoney(precoUnitario, quantidade);
        const descontoItem = roundMoney(item.descontoItem ?? ZERO);
        const valorTotal = subtractMoney(valorBruto, descontoItem);

        return {
            produtoId: item.produtoId,
            quantidade,
            precoUnitario,
            descontoItem,
            valorBruto,
            valorTotal
        };
    });

    const grossTotals = items.map((item) => toBigMoney(item.valorBruto));
    const totalBruto = roundMoney(grossTotals.reduce((acc, gross) => acc.plus(gross), new Big(0)));

    let descontoVenda = roundMoney(input.descontoVenda ?? ZERO);
    descontoVenda = clampDiscount(descontoVenda, totalBruto);

    const hasSaleLevelDiscount = isMoneyGreaterThan(descontoVenda, ZERO);

    if (hasSaleLevelDiscount) {
        const saleDiscountBig = toBigMoney(descontoVenda);
        const distributedDiscounts = calculateItemDiscounts(grossTotals, saleDiscountBig);

        items.forEach((item, index) => {
            const descontoItem = distributedDiscounts[index];
            const valorTotal = subtractMoney(item.valorBruto, descontoItem);
            item.descontoItem = descontoItem;
            item.valorTotal = valorTotal;
        });
    } else {
        const descontoTotal = items.reduce<string>((acc, item) => addMoney(acc, item.descontoItem), ZERO);
        descontoVenda = clampDiscount(descontoTotal, totalBruto);
    }

    const valorTotal = items.reduce<string>((acc, item) => addMoney(acc, item.valorTotal), ZERO);

    return {
        descontoVenda,
        valorTotal,
        itens: items,
        totalBruto
    };
};
