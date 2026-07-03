import { Router, type IRouter } from "express";
import healthRouter from "./health";
import departmentsRouter from "./departments";
import initiativesRouter from "./initiatives";
import dependenciesRouter from "./dependencies";
import riskCategoriesRouter from "./risk-categories";
import insightsRouter from "./insights";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(departmentsRouter);
router.use(initiativesRouter);
router.use(dependenciesRouter);
router.use(riskCategoriesRouter);
router.use(insightsRouter);
router.use(settingsRouter);

export default router;
