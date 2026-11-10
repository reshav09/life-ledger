const express = require('express');
const router = express.Router();
const prepService = require('../services/jobhuntPrepIntelligence');
const questionBankService = require('../services/jobhuntQuestionBank');

// GET /api/jobhunt/prep — list all plans with optional filters
router.get('/', async (req, res, next) => {
  try {
    const { search, roleCategory, confidence, orgId } = req.query;
    // Ensure pre-seeded plans exist
    await prepService.ensurePreSeededPlans();
    const plans = await prepService.getPrepPlans({ search, roleCategory, confidence, orgId });
    res.json(plans);
  } catch (err) {
    next(err);
  }
});

// GET /api/jobhunt/prep/resources — return the master catalog of curated resources
router.get('/resources', async (req, res, next) => {
  try {
    res.json(prepService.CURATED_RESOURCES);
  } catch (err) {
    next(err);
  }
});

// GET /api/jobhunt/prep/org/:orgId — get plan by orgId
router.get('/org/:orgId', async (req, res, next) => {
  try {
    await prepService.ensurePreSeededPlans();
    const plans = await prepService.getPrepPlans({ orgId: req.params.orgId });
    if (plans.length > 0) {
      return res.json(plans[0]);
    }
    res.status(404).json({ error: 'No preparation roadmap found for this organization.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/jobhunt/prep/questions — fetch real questions with filters
router.get('/questions', async (req, res, next) => {
  try {
    const { category, company, topic, difficulty, search, isSolved, limit, offset } = req.query;
    const questions = await questionBankService.getQuestions({
      category,
      company,
      topic,
      difficulty,
      search,
      isSolved,
      limit,
      offset
    });
    res.json(questions);
  } catch (err) {
    next(err);
  }
});

// GET /api/jobhunt/prep/questions/stats — progress stats across categories
router.get('/questions/stats', async (req, res, next) => {
  try {
    const stats = await questionBankService.getQuestionStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// PUT /api/jobhunt/prep/questions/:id/solve — mark question solved/unsolved
router.put('/questions/:id/solve', async (req, res, next) => {
  try {
    const { isSolved } = req.body;
    const updated = await questionBankService.toggleQuestionSolved(req.params.id, isSolved);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/jobhunt/prep/questions/:id/notes — save candidate question notes
router.put('/questions/:id/notes', async (req, res, next) => {
  try {
    const { notes } = req.body;
    const updated = await questionBankService.updateQuestionNotes(req.params.id, notes);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/jobhunt/prep/:id — get single plan
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await prepService.getPrepPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ error: 'Preparation roadmap not found.' });
    }
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

// POST /api/jobhunt/prep/research — on-demand research and generation
router.post('/research', async (req, res, next) => {
  try {
    const { orgId, orgName, roleTitle, roleCategory } = req.body;
    if (!orgId && !orgName) {
      return res.status(400).json({ error: 'orgId or orgName is required.' });
    }

    const plan = await prepService.researchAndGeneratePlan({
      orgId,
      orgName,
      roleTitle,
      roleCategory
    });

    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
});

// PUT /api/jobhunt/prep/:id/progress — update candidate checklist progress
router.put('/:id/progress', async (req, res, next) => {
  try {
    const { progress } = req.body;
    const updated = await prepService.updatePrepProgress(req.params.id, progress || {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// PUT /api/jobhunt/prep/:id/notes — update candidate personal notes
router.put('/:id/notes', async (req, res, next) => {
  try {
    const { notes } = req.body;
    const updated = await prepService.updatePrepNotes(req.params.id, notes || '');
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/jobhunt/prep/:id — delete a plan
router.delete('/:id', async (req, res, next) => {
  try {
    const result = await prepService.deletePrepPlan(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
