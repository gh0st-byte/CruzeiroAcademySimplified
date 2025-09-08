const express = require('express');
const controller = require('../controllers/locationTagController');
const router = express.Router();

router.post('/', controller.create);
router.get('/', controller.list);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
