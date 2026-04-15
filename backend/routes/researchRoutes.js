import { Router } from "express";
import { getSession, postResearch } from "../controllers/researchController.js";

const router = Router();

router.post("/research", postResearch);
router.get("/session/:sessionId", getSession);

export default router;
