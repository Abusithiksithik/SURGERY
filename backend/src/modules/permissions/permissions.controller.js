'use strict';
const asyncHandler=require('../../utils/asyncHandler');
const ApiResponse=require('../../utils/ApiResponse');
const service=require('./permissions.service');
exports.list=asyncHandler(async(req,res)=>new ApiResponse(200,await service.list(),'Role permissions').send(res));
exports.update=asyncHandler(async(req,res)=>new ApiResponse(200,await service.update(req.body.roleName,req.body.permissionId,req.body.isGranted,req.user.userId),'Permission updated').send(res));
exports.getUser=asyncHandler(async(req,res)=>new ApiResponse(200,await service.getUserPermissions(req.params.userId),'User permissions').send(res));
exports.updateUser=asyncHandler(async(req,res)=>new ApiResponse(200,await service.setUserPermission(req.params.userId,req.body.permissionKey,req.body.isGranted,req.user.userId),'User permission override saved').send(res));

exports.listUsers=asyncHandler(async(req,res)=>new ApiResponse(200,await service.listUsersForPermissions(),'Users').send(res));
