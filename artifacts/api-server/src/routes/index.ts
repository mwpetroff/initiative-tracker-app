import { Router, type IRouter } from "express";
import healthRouter from "./health";
import departmentsRouter from "./departments";
import initiativesRouter from "./initiatives";
import dependenciesRouter from "./dependencies";
import insightsRouter from "./insights";

const router: IRouter = Router();

router.use(healthRouter);
router.use(departmentsRouter);
router.use(initiativesRouter);
router.use(dependenciesRouter);
router.use(insightsRouter);

export default router;
