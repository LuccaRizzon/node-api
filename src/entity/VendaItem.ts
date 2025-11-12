import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { Venda } from "./Venda";
import { Produto } from "./Produto";

@Entity("venda_itens")
export class VendaItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Venda, venda => venda.itens, { onDelete: "CASCADE" })
    @JoinColumn({ name: "venda_id" })
    venda: Venda;

    @ManyToOne(() => Produto)
    @JoinColumn({ name: "produto_id" })
    produto: Produto;

    @Column({ type: "int", nullable: false })
    quantidade: number;

    @Column({
        type: "decimal",
        precision: 10,
        scale: 2,
        nullable: false,
        transformer: {
            to: (value: string | number) => value,
            from: (value: string) => value
        }
    })
    precoUnitario: string;

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
    descontoItem: string;

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
}

