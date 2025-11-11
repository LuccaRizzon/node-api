import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { VendaItem } from "./VendaItem";

@Entity("produtos")
export class Produto {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 100, nullable: false })
    nome: string;

    @Column({ type: "decimal", precision: 10, scale: 2, nullable: false })
    preco: number;

    @OneToMany(() => VendaItem, vendaItem => vendaItem.produto)
    vendaItens: VendaItem[];
}

