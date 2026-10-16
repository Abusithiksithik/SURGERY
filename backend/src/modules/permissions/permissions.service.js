'use strict';
const { query, queryRows, queryOne } = require('../../config/db');
const ApiError = require('../../utils/ApiError');
const ROLES = ['ADMIN','MANAGEMENT','FINANCE','OT_COORDINATOR','SURGEON','ANAESTHETIST','OT_NURSE','OT_TECHNICIAN','OT_STORE','VIEWER'];

async function list() {
  const rows = await queryRows(`SELECT p.permission_id,p.permission_key,p.description,p.is_active,
      r.role_name,COALESCE(r.is_granted,FALSE) AS is_granted
    FROM system_permissions p CROSS JOIN (VALUES ${ROLES.map((_,i)=>`($${i+1})`).join(',')}) v(role_name)
    LEFT JOIN system_role_permissions r ON r.permission_id=p.permission_id AND r.role_name=v.role_name
    WHERE p.is_active=TRUE ORDER BY p.permission_key,r.role_name`, ROLES);
  return rows.map(r=>({permissionId:r.permission_id,permissionKey:r.permission_key,description:r.description,isActive:r.is_active,roleName:r.role_name,isGranted:Boolean(r.is_granted)}));
}
async function update(roleName, permissionId, isGranted, changedBy) {
  if (!ROLES.includes(roleName)) throw ApiError.badRequest('Unsupported role.');
  const permission = await queryOne('SELECT permission_key FROM system_permissions WHERE permission_id=$1 AND is_active=TRUE',[permissionId]);
  if (!permission) throw ApiError.notFound('Permission not found.');
  if (roleName === 'ADMIN' && permission.permission_key === 'MANAGE_ROLE_PERMISSIONS' && !isGranted) {
    throw ApiError.badRequest('ADMIN must retain MANAGE_ROLE_PERMISSIONS.');
  }
  const {rows}=await query(`INSERT INTO system_role_permissions(role_name,permission_id,is_granted,updated_at)
    VALUES($1,$2,$3,now()) ON CONFLICT(role_name,permission_id) DO UPDATE SET is_granted=EXCLUDED.is_granted,updated_at=now() RETURNING *`,[roleName,permissionId,isGranted]);
  await query(`INSERT INTO audit_log(table_name,record_id,action,changed_by,new_values)
    VALUES('system_role_permissions',$1,'UPDATE',$2,$3::jsonb)`,[permissionId,changedBy||null,JSON.stringify({roleName,permissionKey:permission.permission_key,isGranted})]);
  return rows[0];
}
async function listUsersForPermissions() {
 return queryRows('SELECT user_id,username,full_name,role::text AS role,is_active FROM users ORDER BY full_name');
}
async function effectivePermissions(userId) {
  const user=await queryOne('SELECT user_id,role FROM users WHERE user_id=$1 AND is_active=TRUE',[userId]);
  if(!user) throw ApiError.notFound('User not found.');
  const rows=await queryRows(`SELECT p.permission_key,
      CASE WHEN p.permission_key='MANAGE_ROLE_PERMISSIONS' AND u.role='ADMIN' THEN TRUE
           WHEN up.user_id IS NOT NULL THEN up.is_granted
           ELSE COALESCE(rp.is_granted,FALSE) END AS is_granted
    FROM users u CROSS JOIN system_permissions p
    LEFT JOIN system_role_permissions rp ON rp.permission_id=p.permission_id AND rp.role_name=u.role::text
    LEFT JOIN user_permissions up ON up.permission_id=p.permission_id AND up.user_id=u.user_id
    WHERE u.user_id=$1 AND p.is_active=TRUE ORDER BY p.permission_key`,[userId]);
  return rows.map(r=>({permissionKey:r.permission_key,isGranted:Boolean(r.is_granted)}));
}
async function getUserPermissions(userId) {
 const user=await queryOne('SELECT user_id,username,full_name,role FROM users WHERE user_id=$1',[userId]);
 if(!user) throw ApiError.notFound('User not found.');
 const [effective,overrides]=await Promise.all([
  effectivePermissions(userId),
  queryRows(`SELECT p.permission_key,up.is_granted,up.granted_by,up.granted_at
    FROM user_permissions up JOIN system_permissions p ON p.permission_id=up.permission_id
    WHERE up.user_id=$1 ORDER BY p.permission_key`,[userId])
 ]);
 return {user,effective,overrides};
}
async function setUserPermission(userId, permissionKey, isGranted, changedBy) {
 const user=await queryOne('SELECT user_id FROM users WHERE user_id=$1',[userId]);
 if(!user) throw ApiError.notFound('User not found.');
 const p=await queryOne('SELECT permission_id FROM system_permissions WHERE permission_key=$1 AND is_active=TRUE',[permissionKey]);
 if(!p) throw ApiError.notFound('Permission not found.');
 const {rows}=await query(`INSERT INTO user_permissions(user_id,permission_id,is_granted,granted_by,granted_at,created_by,created_at,updated_at)
   VALUES($1,$2,$3,$4,now(),$4,now(),now())
   ON CONFLICT(user_id,permission_id) DO UPDATE SET is_granted=EXCLUDED.is_granted,granted_by=EXCLUDED.granted_by,granted_at=now(),updated_at=now()
   RETURNING *`,[userId,p.permission_id,isGranted,changedBy||null]);
 await query(`INSERT INTO audit_log(table_name,record_id,action,changed_by,new_values)
   VALUES('user_permissions',$1,'UPDATE',$2,$3::jsonb)`,[userId,changedBy||null,JSON.stringify({userId,permissionKey,isGranted})]);
 return rows[0];
}
module.exports={list,update,effectivePermissions,getUserPermissions,setUserPermission,listUsersForPermissions};
