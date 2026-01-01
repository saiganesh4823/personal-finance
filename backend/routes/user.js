/**
 * User Management Routes
 * Handles user profile, settings, and account management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const AuthService = require('../services/AuthService');
const createAuthMiddleware = require('../middleware/auth');

function createUserRoutes(pool) {
    const router = express.Router();
    const authService = new AuthService(pool);
    const { authenticateToken } = createAuthMiddleware(pool);

    // All user routes require authentication
    router.use(authenticateToken);

    /**
     * GET /user/profile
     * Get user profile information
     */
    router.get('/profile', async (req, res) => {
        try {
            const user = await authService.getUserById(req.userId);
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    profilePicture: user.profile_picture,
                    createdAt: user.created_at,
                    lastLogin: user.last_login
                }
            });

        } catch (error) {
            console.error('Get profile error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to get user profile',
                code: 'GET_PROFILE_ERROR'
            });
        }
    });

    /**
     * PUT /user/profile
     * Update user profile information
     */
    router.put('/profile', [
        body('firstName')
            .optional()
            .isLength({ max: 100 })
            .withMessage('First name must be less than 100 characters'),
        body('lastName')
            .optional()
            .isLength({ max: 100 })
            .withMessage('Last name must be less than 100 characters'),
        body('email')
            .optional()
            .isEmail()
            .normalizeEmail()
            .withMessage('Valid email is required')
    ], async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: errors.array()
                });
            }

            const { firstName, lastName, email } = req.body;
            const updates = {};
            
            if (firstName !== undefined) updates.first_name = firstName;
            if (lastName !== undefined) updates.last_name = lastName;
            if (email !== undefined) updates.email = email;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    error: 'No fields to update',
                    code: 'NO_UPDATES'
                });
            }

            // Check if email is already taken by another user
            if (email) {
                const [existingUsers] = await pool.execute(
                    'SELECT id FROM users WHERE email = ? AND id != ?',
                    [email, req.userId]
                );

                if (existingUsers.length > 0) {
                    return res.status(409).json({
                        error: 'Email is already taken',
                        code: 'EMAIL_TAKEN'
                    });
                }
            }

            // Update user profile
            const updateFields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
            const updateValues = Object.values(updates);
            
            await pool.execute(
                `UPDATE users SET ${updateFields}, updated_at = NOW() WHERE id = ?`,
                [...updateValues, req.userId]
            );

            // Get updated user data
            const updatedUser = await authService.getUserById(req.userId);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user: {
                    id: updatedUser.id,
                    username: updatedUser.username,
                    email: updatedUser.email,
                    firstName: updatedUser.first_name,
                    lastName: updatedUser.last_name,
                    profilePicture: updatedUser.profile_picture
                }
            });

        } catch (error) {
            console.error('Update profile error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to update profile',
                code: 'UPDATE_PROFILE_ERROR'
            });
        }
    });

    /**
     * GET /user/settings
     * Get user settings
     */
    router.get('/settings', async (req, res) => {
        try {
            const [settings] = await pool.execute(
                'SELECT setting_key, setting_value FROM settings WHERE user_id = ?',
                [req.userId]
            );

            const settingsObject = {};
            settings.forEach(setting => {
                settingsObject[setting.setting_key] = setting.setting_value;
            });

            res.json({
                success: true,
                settings: settingsObject
            });

        } catch (error) {
            console.error('Get settings error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to get user settings',
                code: 'GET_SETTINGS_ERROR'
            });
        }
    });

    /**
     * PUT /user/settings
     * Update user settings
     */
    router.put('/settings', async (req, res) => {
        try {
            const settings = req.body;
            
            if (!settings || Object.keys(settings).length === 0) {
                return res.status(400).json({
                    error: 'No settings to update',
                    code: 'NO_SETTINGS'
                });
            }

            // Update each setting
            for (const [key, value] of Object.entries(settings)) {
                await pool.execute(
                    `INSERT INTO settings (setting_key, user_id, setting_value, updated_at) 
                     VALUES (?, ?, ?, NOW()) 
                     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
                    [key, req.userId, value]
                );
            }

            res.json({
                success: true,
                message: 'Settings updated successfully'
            });

        } catch (error) {
            console.error('Update settings error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to update settings',
                code: 'UPDATE_SETTINGS_ERROR'
            });
        }
    });

    /**
     * GET /user/export
     * Export all user data
     */
    router.get('/export', async (req, res) => {
        try {
            // Get user profile
            const user = await authService.getUserById(req.userId);
            
            // Get user transactions
            const [transactions] = await pool.execute(
                'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC',
                [req.userId]
            );

            // Get user categories
            const [categories] = await pool.execute(
                'SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC',
                [req.userId]
            );

            // Get user settings
            const [settings] = await pool.execute(
                'SELECT setting_key, setting_value FROM settings WHERE user_id = ?',
                [req.userId]
            );

            const settingsObject = {};
            settings.forEach(setting => {
                settingsObject[setting.setting_key] = setting.setting_value;
            });

            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    createdAt: user.created_at
                },
                transactions,
                categories,
                settings: settingsObject
            };

            res.json({
                success: true,
                data: exportData
            });

        } catch (error) {
            console.error('Export data error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to export user data',
                code: 'EXPORT_ERROR'
            });
        }
    });

    /**
     * DELETE /user/account
     * Delete user account and all associated data
     */
    router.delete('/account', [
        body('password').notEmpty().withMessage('Password is required for account deletion'),
        body('confirmation').equals('DELETE').withMessage('Confirmation must be "DELETE"')
    ], async (req, res) => {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'Validation failed',
                    code: 'VALIDATION_ERROR',
                    details: errors.array()
                });
            }

            const { password } = req.body;

            // Verify password before deletion
            const [users] = await pool.execute(
                'SELECT password_hash FROM users WHERE id = ?',
                [req.userId]
            );

            if (users.length === 0) {
                return res.status(404).json({
                    error: 'User not found',
                    code: 'USER_NOT_FOUND'
                });
            }

            const isPasswordValid = await authService.comparePassword(password, users[0].password_hash);
            if (!isPasswordValid) {
                return res.status(400).json({
                    error: 'Invalid password',
                    code: 'INVALID_PASSWORD'
                });
            }

            // Delete user account (cascade will delete all related data)
            await pool.execute('DELETE FROM users WHERE id = ?', [req.userId]);

            res.json({
                success: true,
                message: 'Account deleted successfully'
            });

        } catch (error) {
            console.error('Delete account error:', error.message);
            
            return res.status(500).json({
                error: 'Failed to delete account',
                code: 'DELETE_ACCOUNT_ERROR'
            });
        }
    });

    return router;
}

module.exports = createUserRoutes;