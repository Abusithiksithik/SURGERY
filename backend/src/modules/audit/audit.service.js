'use strict';
const { queryRows } = require('../../config/db');
const { parsePagination, buildPaginationMeta } = require('../../utils/pagination');
async function list(params={}) {
  const {page,limit,skip,take}=parsePagination(params); const vals=[]; const where=[];
  if(params.surgeryId){vals.push(params.surgeryId);where.push(`a.surgery_id=$${vals.length}`)}
  if(params.tableName){vals.push(params.tableName);where.push(`a.table_name=$${vals.length}`)}
  if(params.action){vals.push(params.action);where.push(`a.action=$${vals.length}`)}
  if(params.userId){vals.push(params.userId);where.push(`a.changed_by=$${vals.length}`)}
  if(params.dateFrom){vals.push(params.dateFrom);where.push(`a.changed_at >= $${vals.length}::date`)}
  if(params.dateTo){vals.push(params.dateTo);where.push(`a.changed_at < ($${vals.length}::date + INTERVAL '1 day')`)}
  const clause=where.length?`WHERE ${where.join(' AND ')}`:'';
  const [{count}]=await queryRows(`SELECT COUNT(*)::int AS count FROM audit_log a ${clause}`,vals);
  const rows=await queryRows(`SELECT a.*,u.full_name AS changed_by_name FROM audit_log a LEFT JOIN users u ON u.user_id=a.changed_by ${clause} ORDER BY a.changed_at DESC LIMIT $${vals.length+1} OFFSET $${vals.length+2}`,[...vals,take,skip]);
  const items=rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),value])));
  return {items,meta:buildPaginationMeta({page,limit,totalCount:Number(count)})};
}
module.exports={list};
