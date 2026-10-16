import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Checkbox, FormControl, InputLabel, MenuItem, Paper, Select, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Typography } from '@mui/material';
import { PageHeader } from '@/components/common/PageHeader';
import { apiClient } from '@/api/client';
import type { ApiEnvelope } from '@/api/types';

const ROLES=['ADMIN','MANAGEMENT','FINANCE','OT_COORDINATOR','SURGEON','ANAESTHETIST','OT_NURSE','OT_TECHNICIAN','OT_STORE','VIEWER'];
interface RoleRow {permissionId:string;permissionKey:string;description:string;roleName:string;isGranted:boolean}
interface Permission {permissionKey:string;isGranted:boolean}
interface UserRow {user_id:string;username:string;full_name:string;role:string;is_active:boolean}
interface UserPermissions {user:{user_id:string;username:string;full_name:string;role:string};effective:Permission[];overrides:{permission_key:string;is_granted:boolean}[]}
export function PermissionsPage(){
 const qc=useQueryClient();const [tab,setTab]=useState(0);const [userId,setUserId]=useState('');
 const rolesQuery=useQuery({queryKey:['permissions'],queryFn:async()=>{const r=await apiClient.get<ApiEnvelope<RoleRow[]>>('/permissions/roles');return r.data.data;}});
 const usersQuery=useQuery({queryKey:['permission-users'],queryFn:async()=>{const r=await apiClient.get<ApiEnvelope<UserRow[]>>('/permissions/users');return r.data.data;}});
 const userQuery=useQuery({queryKey:['user-permissions',userId],enabled:!!userId,queryFn:async()=>{const r=await apiClient.get<ApiEnvelope<UserPermissions>>(`/permissions/users/${userId}`);return r.data.data;}});
 const roleMutation=useMutation({mutationFn:async(v:{roleName:string;permissionId:string;isGranted:boolean})=>apiClient.patch('/permissions/roles',v),onSuccess:()=>qc.invalidateQueries({queryKey:['permissions']})});
 const userMutation=useMutation({mutationFn:async(v:{permissionKey:string;isGranted:boolean})=>apiClient.patch(`/permissions/users/${userId}`,v),onSuccess:()=>{qc.invalidateQueries({queryKey:['user-permissions',userId]});qc.invalidateQueries({queryKey:['permissions']});}});
 const data=rolesQuery.data??[];const permissions=[...new Map(data.map(r=>[r.permissionId,r])).values()];const find=(p:string,role:string)=>(data.find(r=>r.permissionId===p&&r.roleName===role)?.isGranted??false);
 const overrides=new Map((userQuery.data?.overrides??[]).map(o=>[o.permission_key,o.is_granted]));
 return <Box><PageHeader title="Roles & Permissions" subtitle="Role grants and individual user overrides. A user-specific grant or revoke takes precedence over the role grant."/>
 <Tabs value={tab} onChange={(_,v)=>setTab(v)} sx={{mb:2}}><Tab label="Role Permissions"/><Tab label="User Overrides"/></Tabs>
 {tab===0&&<>{!rolesQuery.isLoading&&!data.length&&<Alert severity="info">No permission data available.</Alert>}<TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>Permission</TableCell>{ROLES.map(r=><TableCell key={r} align="center">{r}</TableCell>)}</TableRow></TableHead><TableBody>{permissions.map(p=><TableRow key={p.permissionId} hover><TableCell><Typography fontWeight={600}>{p.permissionKey}</Typography><Typography variant="caption" color="text.secondary">{p.description}</Typography></TableCell>{ROLES.map(role=><TableCell key={role} align="center"><Checkbox checked={find(p.permissionId,role)} disabled={roleMutation.isPending||(role==='ADMIN'&&p.permissionKey==='MANAGE_ROLE_PERMISSIONS')} onChange={e=>roleMutation.mutate({roleName:role,permissionId:p.permissionId,isGranted:e.target.checked})}/></TableCell>)}</TableRow>)}</TableBody></Table></TableContainer></>}
 {tab===1&&<><FormControl size="small" fullWidth sx={{maxWidth:520,mb:2}}><InputLabel>Application user</InputLabel><Select value={userId} label="Application user" onChange={e=>setUserId(e.target.value)}><MenuItem value="">Select user</MenuItem>{(usersQuery.data??[]).map(u=><MenuItem key={u.user_id} value={u.user_id}>{u.full_name} ({u.username}) — {u.role}{u.is_active?'':' [Inactive]'}</MenuItem>)}</Select></FormControl>
 {userId&&userQuery.data&&<><Typography variant="subtitle1" fontWeight={700} sx={{mb:1}}>Effective permissions for {userQuery.data.user.full_name}</Typography><TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>Permission</TableCell><TableCell>Role grant</TableCell><TableCell>User override</TableCell><TableCell>Effective</TableCell></TableRow></TableHead><TableBody>{userQuery.data.effective.map(p=>{const override=overrides.get(p.permissionKey);const roleGrant=data.find(r=>r.permissionKey===p.permissionKey&&r.roleName===userQuery.data?.user.role)?.isGranted??false;return <TableRow key={p.permissionKey}><TableCell><Typography fontWeight={600}>{p.permissionKey}</Typography></TableCell><TableCell>{roleGrant?'Granted':'Not granted'}</TableCell><TableCell><Checkbox checked={override===undefined?p.isGranted:override} indeterminate={override===undefined} disabled={userMutation.isPending||(userQuery.data?.user.role==='ADMIN'&&p.permissionKey==='MANAGE_ROLE_PERMISSIONS')} onChange={e=>userMutation.mutate({permissionKey:p.permissionKey,isGranted:e.target.checked})}/>{override===undefined?'Inherit':override?'Grant':'Revoke'}</TableCell><TableCell>{p.isGranted?'Granted':'Not granted'}</TableCell></TableRow>;})}</TableBody></Table></TableContainer><Alert severity="info" sx={{mt:2}}>An unchecked inherited checkbox means the permission follows the role. Click it to create an explicit grant or revoke for this user.</Alert></>}
 </>}
 </Box>;
}
