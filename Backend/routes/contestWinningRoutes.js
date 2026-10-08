const express = require('express');
const {
    syncContestWinningsController,
    getContestWinningsMasterController,
    getLastSyncDetailsController,
    getScratchWinReconciliationController
} = require('../controllers/contestWinningController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/master', verifyToken, verifyPermission(['contest_winnings_master', 'scratch_win_reconciliation'], 'read'), getContestWinningsMasterController);
router.get('/reconciliation', verifyToken, verifyPermission(['scratch_win_reconciliation', 'contest_winnings_master'], 'read'), getScratchWinReconciliationController);
router.get('/last-sync', verifyToken, getLastSyncDetailsController);
router.post('/sync', verifyToken, verifyPermission(['contest_winnings_master', 'scratch_win_reconciliation'], 'write'), syncContestWinningsController);

module.exports = router;
