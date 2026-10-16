'use strict'; const asyncHandler=require('../../utils/asyncHandler'); const ApiResponse=require('../../utils/ApiResponse'); const service=require('./audit.service');
exports.list=asyncHandler(async(req,res)=>{const r=await service.list(req.query);return new ApiResponse(200,r.items,'Audit trail',r.meta).send(res)});
