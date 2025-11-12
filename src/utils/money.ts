import Big from "big.js";

export type MoneyInput = string | number | Big;

export const toBigMoney = (value: MoneyInput): Big => {
    if (value instanceof Big) {
        return value;
    }
    if (typeof value === "string") {
        return new Big(value);
    }
    if (typeof value === "number") {
        return new Big(value);
    }
    return new Big(0);
};

export const toBig = (value: MoneyInput): Big => toBigMoney(value);

export const toMoneyString = (value: Big | MoneyInput, scale: number = 2): string => {
    const bigValue = value instanceof Big ? value : toBigMoney(value);
    return bigValue.round(scale, Big.roundHalfUp).toFixed(scale);
};

export const addMoney = (...values: MoneyInput[]): string => {
    const total = values.reduce<Big>((acc, current) => acc.plus(toBigMoney(current)), new Big(0));
    return toMoneyString(total);
};

export const subtractMoney = (value: MoneyInput, subtractor: MoneyInput): string => {
    const result = toBigMoney(value).minus(toBigMoney(subtractor));
    return toMoneyString(result);
};

export const subMoney = subtractMoney;

export const multiplyMoney = (value: MoneyInput, multiplier: MoneyInput): string => {
    const result = toBigMoney(value).times(toBigMoney(multiplier));
    return toMoneyString(result);
};

export const mulMoney = multiplyMoney;

export const divideMoney = (value: MoneyInput, divisor: MoneyInput): string => {
    const result = toBigMoney(value).div(toBigMoney(divisor));
    return toMoneyString(result);
};

export const divMoney = divideMoney;

export const roundMoney = (value: MoneyInput, scale: number = 2): string => {
    return toMoneyString(value, scale);
};

export const maxMoney = (a: MoneyInput, b: MoneyInput): string => {
    return toBigMoney(a).cmp(toBigMoney(b)) >= 0 ? roundMoney(a) : roundMoney(b);
};

export const isMoneyGreaterThan = (a: MoneyInput, b: MoneyInput): boolean => {
    return toBigMoney(a).gt(toBigMoney(b));
};

export const isMoneyLessThan = (a: MoneyInput, b: MoneyInput): boolean => {
    return toBigMoney(a).lt(toBigMoney(b));
};

export const toMoneyNumber = (value: MoneyInput): number => {
    return parseFloat(roundMoney(value));
};

export const ZERO = roundMoney(0);


