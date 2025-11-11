import { Router } from "express";
import { VendaController } from "../controller/VendaController";

const router = Router();
const vendaController = new VendaController();

router.post("/", (req, res) => vendaController.create(req, res));
router.get("/", (req, res) => vendaController.list(req, res));
router.get("/:id", (req, res) => vendaController.findById(req, res));
router.put("/:id", (req, res) => vendaController.update(req, res));
router.delete("/:id", (req, res) => vendaController.delete(req, res));

export { router as routerVenda };

