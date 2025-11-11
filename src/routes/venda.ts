import { Router } from "express";
import { VendaController } from "../controller/VendaController";
import { validate } from "../middleware/validationMiddleware";
import { 
    validateCreateVenda, 
    validateUpdateVenda, 
    validateId, 
    validateListQuery 
} from "../validation/vendaValidation";

const router = Router();
const vendaController = new VendaController();

router.post("/", validate(validateCreateVenda), (req, res) => vendaController.create(req, res));
router.get("/", validate(validateListQuery), (req, res) => vendaController.list(req, res));
router.get("/:id", validate(validateId), (req, res) => vendaController.findById(req, res));
router.put("/:id", validate([...validateId, ...validateUpdateVenda]), (req, res) => vendaController.update(req, res));
router.delete("/:id", validate(validateId), (req, res) => vendaController.delete(req, res));

export { router as routerVenda };
