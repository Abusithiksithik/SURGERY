'use strict';
const express=require('express'); const Joi=require('joi'); const c=require('./permissions.controller');
const validate=require('../../middleware/validate.middleware'); const {authenticate}=require('../../middleware/auth.middleware');
const {requirePermission}=require('../../middleware/permission.middleware'); const router=express.Router();
const id=Joi.string().uuid().required();
router.get('/',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({query:Joi.object({})}),c.list);
router.get('/roles',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({query:Joi.object({})}),c.list);
const roleBody=Joi.object({roleName:Joi.string().valid('ADMIN','MANAGEMENT','FINANCE','OT_COORDINATOR','SURGEON','ANAESTHETIST','OT_NURSE','OT_TECHNICIAN','OT_STORE','VIEWER').required(),permissionId:id,isGranted:Joi.boolean().required()});
router.patch('/',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({body:roleBody}),c.update);
router.patch('/roles',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({body:roleBody}),c.update);
/*({roleName:Joi.string().valid('ADMIN','MANAGEMENT','FINANCE','OT_COORDINATOR','SURGEON','ANAESTHETIST','OT_NURSE','OT_TECHNICIAN','OT_STORE','VIEWER').required(),permissionId:id,isGranted:Joi.boolean().required()*/
router.get('/users',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({query:Joi.object({})}),c.listUsers);
router.get('/users/:userId',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({params:Joi.object({userId:id})}),c.getUser);
router.patch('/users/:userId',authenticate,requirePermission('MANAGE_ROLE_PERMISSIONS'),validate({params:Joi.object({userId:id}),body:Joi.object({permissionKey:Joi.string().max(100).required(),isGranted:Joi.boolean().required()})}),c.updateUser);
module.exports=router;
