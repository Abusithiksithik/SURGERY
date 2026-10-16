import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { PageHeader } from '@/components/common/PageHeader';
import * as schedulingApi from '@/api/scheduling.api';

export function PreOpChecklistListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['preop-nav-schedules'], queryFn: () => schedulingApi.listSchedules({ limit: 200 }) });
  const rows = (data?.data ?? []).filter(s => !['CANCELLED','POSTPONED','COMPLETED'].includes(s.status));
  return <Box><PageHeader title="Pre-Op Checklist" subtitle="Open the checklist for a scheduled surgery." />{isLoading ? <Typography>Loading…</Typography> : <TableContainer component={Paper}><Table size="small"><TableHead><TableRow><TableCell>Surgery</TableCell><TableCell>Patient</TableCell><TableCell>Date</TableCell><TableCell>Status</TableCell><TableCell/></TableRow></TableHead><TableBody>{rows.map(s=><TableRow key={s.scheduleId} hover><TableCell>{s.surgeryNumber ?? s.surgeryId.slice(0,8)}</TableCell><TableCell>{s.patientFullName ?? '—'}<Typography variant="caption" display="block" color="text.secondary">{s.mrNumber ?? ''}</Typography></TableCell><TableCell>{s.plannedDate}</TableCell><TableCell><Chip size="small" label={s.status}/></TableCell><TableCell><Button size="small" variant="outlined" onClick={()=>navigate(`/scheduling/${s.scheduleId}?tab=preop`)}>Open Checklist</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>}</Box>;
}
