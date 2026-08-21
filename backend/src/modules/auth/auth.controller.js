'use strict';

const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiResponse = require('../../utils/ApiResponse');

const register = asyncHandler(async (req, res) => {
  const user = await authService.register(req.body);
  return new ApiResponse(201, user, 'User registered successfully').send(res);
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  return new ApiResponse(200, result, 'Login successful').send(res);
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  return new ApiResponse(200, result, 'Token refreshed').send(res);
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword(req.user.userId, req.body);
  return new ApiResponse(200, null, 'Password changed successfully').send(res);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getProfile(req.user.userId);
  return new ApiResponse(200, user).send(res);
});

module.exports = { register, login, refresh, changePassword, me };
