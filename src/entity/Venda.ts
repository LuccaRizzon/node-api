import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from "typeorm";
import { VendaItem } from "./VendaItem";

export enum StatusVenda {
    ABERTA = "Aberta",
    CONCLUIDA = "Concluída",
    CANCELADA = "Cancelada"
}

@Entity("vendas")
export class Venda {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 50, nullable: false, unique: true })
    codigo: string;

    @CreateDateColumn({ type: "datetime" })
    dataHora: Date;

    @Column({ type: "varchar", length: 100, nullable: false })
    nomeCliente: string;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: false,
        default: 0,
        transformer: {
            to: (value: string | number) => value,
            from: (value: string) => value
        }
    })
    descontoVenda: string;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: false,
        default: 0,
        transformer: {
            to: (value: string | number) => value,
            from: (value: string) => value
        }
    })
    valorTotal: string;

    @Column({ type: "varchar", length: 20, nullable: false, default: StatusVenda.ABERTA })
    status: StatusVenda;

    @OneToMany(() => VendaItem, vendaItem => vendaItem.venda, { cascade: true })
    itens: VendaItem[];
}

