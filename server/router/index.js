// server/router/index.js
const Router = require('express').Router;
const userController = require('../controllers/user-controller');
const router = new Router();
const { body } = require('express-validator');
const authMiddleware = require('../middlewares/auth-middleware');
const upload = require('../middlewares/upload');

router.post(
  '/registration',
  body('email').isEmail(),
  body('password').isLength({ min: 3, max: 32 }),
  userController.registration
);
router.post('/login', userController.login);
router.post('/logout', userController.logout);

// новый маршрут:
router.post('/guest', userController.guest);

router.get('/activate/:link', userController.activate);
router.get('/refresh', userController.refresh);
router.get('/users', authMiddleware, userController.getUsers);
router.get('/me', authMiddleware, userController.getMe);
router.patch('/me', authMiddleware, upload.single('avatar'), userController.updateProfile);

module.exports = router;
