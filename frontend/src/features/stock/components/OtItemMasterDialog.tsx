import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, MenuItem, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getErrorMessage } from '@/api/client';

type Props = { open: boolean; onClose: () => void; onSaved: (itemId: string) => void };
const categories = [
  ['INJECTABLE_DRUG','Injectable / Drug'],['IV_FLUID','IV Fluid'],['SUTURE','Suture'],['IMPLANT_STENT_MESH','Implant / Stent / Mesh'],
  ['CATHETER_TUBE_SET','Catheter / Tube / Set'],['SYRINGE_NEEDLE_CANNULA','Syringe / Needle / Cannula'],['GLOVES','Gloves'],
  ['ANTISEPTIC_SOLUTION','Antiseptic / Solution'],['DRESSING_PLASTER_TAPE','Dressing / Plaster / Tape'],['LINEN_DRAPE','Linen / Drape'],
  ['ANAESTHESIA_AGENT_CONSUMABLE','Anaesthesia Agent / Consumable'],['SURGICAL_DISPOSABLE','Surgical Disposable'],['OTHER','Other'],
];
const uoms = ['NOS','AMP','VIAL','BTL','BAG','PAIR','PKT','BOX','SET','KIT','ROLL','TUBE','STRIP','TAB','ML'];
const today = () => { const d = new Date(); const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };
const initial = { item_name:'', generic_name:'', category:'', spec:'', storage:'ROOM_TEMP', uom:'NOS', fixed_qty_in_ot:'', pack_size:'', purchase_rate:'', default_source:'CENTRAL_STORE', track_batch:true, track_expiry:true, track_serial:false, is_controlled_high_alert:false, is_billable:true, opening_qty:'', opening_batches:[] as Array<{quantity:string;batch_no:string;expiry_date:string;serial_no:string}>, opening_batch_no:'', opening_expiry_date:'', opening_serial_no:'', is_active:true, added_on:today(), remarks:'' };
export function OtItemMasterDialog({ open, onClose, onSaved }: Props) {
  const [form,setForm]=useState(initial); const [error,setError]=useState(''); const qc=useQueryClient();
  useEffect(()=>{ if(open){setForm(initial);setError('');} },[open]);
  const save=useMutation({mutationFn:async()=>{const payload={...form,item_name:form.item_name.trim(),category:form.category,uom:form.uom,unit:form.uom, fixed_qty_in_ot:form.fixed_qty_in_ot===''?0:Number(form.fixed_qty_in_ot),opening_qty:form.opening_qty===''?0:Number(form.opening_qty),opening_batch_no:form.opening_batch_no.trim()||null,opening_expiry_date:form.opening_expiry_date||null,opening_serial_no:form.opening_serial_no.trim()||null,opening_batches:form.opening_batches.map(row=>({quantity:Number(row.quantity),batch_no:row.batch_no.trim()||null,expiry_date:row.expiry_date||null,serial_no:row.serial_no.trim()||null})),added_on:form.added_on,pack_size:form.pack_size===''?null:Number(form.pack_size),purchase_rate:form.purchase_rate===''?null:Number(form.purchase_rate),standard_cost:form.purchase_rate===''?null:Number(form.purchase_rate)};const r=await apiClient.post('/masters/items',payload);return r.data.data as {itemId:string};},onSuccess:(item)=>{qc.invalidateQueries({queryKey:['stock','items']});qc.invalidateQueries({queryKey:['sprint1-master','items']});onSaved(item.itemId);},onError:e=>setError(getErrorMessage(e))});
  const setOpeningQty = (value:string) => {
    const total = Math.max(0, Number(value) || 0);
    const count = Math.min(500, Math.ceil(total));
    setForm(p => {
      const rows = Array.from({length:count}, (_,i) => p.opening_batches[i] || ({quantity:String(i===count-1 ? Math.max(0,total-i) : 1),batch_no:'',expiry_date:'',serial_no:''}));
      if (count && rows.length) {
        const sumOther = rows.slice(0,-1).reduce((sum,r)=>sum+(Number(r.quantity)||0),0);
        if (!p.opening_batches.length) rows[count-1].quantity = String(Math.max(0,total-sumOther));
      }
      return {...p,opening_qty:value,opening_batches:rows};
    });
  };
  const updateOpeningBatch = (index:number,key:'quantity'|'batch_no'|'expiry_date'|'serial_no',value:string) => setForm(p=>({...p,opening_batches:p.opening_batches.map((row,i)=>i===index?{...row,[key]:value}:row)}));
  const field=(name:'item_name'|'generic_name'|'category'|'spec'|'storage'|'uom'|'fixed_qty_in_ot'|'pack_size'|'purchase_rate'|'default_source'|'remarks'|'opening_qty'|'opening_batch_no'|'opening_expiry_date'|'opening_serial_no'|'added_on',value:string)=>setForm(p=>({...p,[name]:value}));
  return <Dialog open={open} onClose={save.isPending?undefined:onClose} fullWidth maxWidth="md"><DialogTitle>Add Item — OT Fixed Stock</DialogTitle><DialogContent dividers>
    <Box component="form" autoComplete="off" onSubmit={e=>{e.preventDefault();save.mutate();}}>
      <Grid container spacing={2}>
        <Grid item xs={12}><b>ITEM DETAILS</b></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth disabled label="Item Code (auto)" value="Generated on save" /></Grid>
        <Grid item xs={12} md={8}><TextField fullWidth required label="Item Name" value={form.item_name} onChange={e=>field('item_name',e.target.value)} /></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth label="Generic Name" value={form.generic_name} onChange={e=>field('generic_name',e.target.value)} /></Grid>
        <Grid item xs={12} md={4}><TextField select fullWidth required label="Category" value={form.category} onChange={e=>field('category',e.target.value)}><MenuItem value="">— select —</MenuItem>{categories.map(([v,l])=><MenuItem key={v} value={v}>{l}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth label="Strength / Size" value={form.spec} onChange={e=>field('spec',e.target.value)} /></Grid>
        <Grid item xs={12} md={4}><TextField select fullWidth label="Storage" value={form.storage} onChange={e=>field('storage',e.target.value)}><MenuItem value="ROOM_TEMP">Room Temp</MenuItem><MenuItem value="REFRIGERATED">Refrigerated</MenuItem><MenuItem value="FROZEN">Frozen</MenuItem><MenuItem value="CONTROLLED">Controlled</MenuItem></TextField></Grid>
        <Grid item xs={12}><b>QUANTITY &amp; PACKING</b></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Fixed Qty in OT" inputProps={{min:0,step:'any'}} value={form.fixed_qty_in_ot} onChange={e=>field('fixed_qty_in_ot',e.target.value)} /></Grid>
        <Grid item xs={12} md={4}><TextField select fullWidth required label="UOM (base unit)" value={form.uom} onChange={e=>field('uom',e.target.value)}>{uoms.map(x=><MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Pack Size (units per pack)" inputProps={{min:0.001,step:'any'}} value={form.pack_size} onChange={e=>field('pack_size',e.target.value)} /></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Purchase Rate (₹)" inputProps={{min:0,step:'0.01'}} value={form.purchase_rate} onChange={e=>field('purchase_rate',e.target.value)} /></Grid>
        <Grid item xs={12}><b>REPLACEMENT OF FIXED STOCK</b></Grid>
        <Grid item xs={12} md={5}><TextField select fullWidth label="Default Source" value={form.default_source} onChange={e=>field('default_source',e.target.value)}><MenuItem value="CENTRAL_STORE">Central Store</MenuItem><MenuItem value="PHARMACY">Pharmacy</MenuItem><MenuItem value="OUTSIDE_VENDOR">Outside Vendor</MenuItem></TextField></Grid>
        <Grid item xs={12}><b>TRACKING</b></Grid>
        <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={form.track_batch} onChange={e=>setForm(p=>({...p,track_batch:e.target.checked}))}/>} label="Track Batch" /></Grid>
        <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={form.track_expiry} onChange={e=>setForm(p=>({...p,track_expiry:e.target.checked}))}/>} label="Track Expiry" /></Grid>
        <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={form.track_serial} onChange={e=>setForm(p=>({...p,track_serial:e.target.checked}))}/>} label="Track Serial" /></Grid>
        <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={form.is_controlled_high_alert} onChange={e=>setForm(p=>({...p,is_controlled_high_alert:e.target.checked}))}/>} label="Controlled / High-alert" /></Grid>
        <Grid item xs={12} md={4}><FormControlLabel control={<Checkbox checked={form.is_billable} onChange={e=>setForm(p=>({...p,is_billable:e.target.checked}))}/>} label="Is Billable" /></Grid>
        <Grid item xs={12}><b>OPENING STOCK IN OT (PHYSICAL COUNT — OPTIONAL)</b></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Qty in OT now" inputProps={{min:0,step:'any'}} value={form.opening_qty} onChange={e=>setOpeningQty(e.target.value)} /></Grid>
        {Number(form.opening_qty)>0 && <Grid item xs={12}><Alert severity="info">Enter each physical batch separately. Total batch quantity must equal Qty in OT now.</Alert></Grid>}
        {form.opening_batches.map((row,index)=><Grid container item xs={12} spacing={1} key={index} sx={{border:1,borderColor:'divider',borderRadius:1,p:1,ml:0,mt:1}}>
          <Grid item xs={12}><b>Opening Batch {index+1}</b></Grid>
          <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Quantity" inputProps={{min:0.001,step:'any'}} value={row.quantity} onChange={e=>updateOpeningBatch(index,'quantity',e.target.value)} /></Grid>
          {form.track_batch && <Grid item xs={12} md={3}><TextField fullWidth required label="Batch No" value={row.batch_no} onChange={e=>updateOpeningBatch(index,'batch_no',e.target.value)} /></Grid>}
          {form.track_expiry && <Grid item xs={12} md={3}><TextField fullWidth required type="date" label="Expiry Date" InputLabelProps={{shrink:true}} value={row.expiry_date} onChange={e=>updateOpeningBatch(index,'expiry_date',e.target.value)} /></Grid>}
          {form.track_serial && <Grid item xs={12} md={3}><TextField fullWidth required label="Serial No" value={row.serial_no} onChange={e=>updateOpeningBatch(index,'serial_no',e.target.value)} /></Grid>}
        </Grid>)}
        <Grid item xs={12}><small>Each batch is recorded as a separate append-only OT Stock Ledger entry. Batch number and expiry date are captured independently for every batch.</small></Grid>
        <Grid item xs={12}><b>STATUS</b></Grid>
        <Grid item xs={12} md={4}><TextField select fullWidth label="Status" value={form.is_active?'ACTIVE':'INACTIVE'} onChange={e=>setForm(p=>({...p,is_active:e.target.value==='ACTIVE'}))}><MenuItem value="ACTIVE">Active</MenuItem><MenuItem value="INACTIVE">Inactive</MenuItem></TextField></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="date" label="Added On" InputLabelProps={{shrink:true}} value={form.added_on} onChange={e=>field('added_on',e.target.value)} /></Grid>
        <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Remarks" value={form.remarks} onChange={e=>field('remarks',e.target.value)} /></Grid>
      </Grid>
    </Box>
    {error&&<Alert severity="error" sx={{mt:2}}>{error}</Alert>}
  </DialogContent><DialogActions><Button onClick={onClose} disabled={save.isPending}>Cancel</Button><Button variant="contained" onClick={()=>{if(!form.item_name.trim()||!form.category){setError('Enter Item Name and select Category.');return;}if(Number(form.opening_qty)<0||Number(form.fixed_qty_in_ot)<0){setError('Quantities cannot be negative.');return;}if(Number(form.opening_qty)>0&&Math.abs(form.opening_batches.reduce((sum,row)=>sum+(Number(row.quantity)||0),0)-Number(form.opening_qty))>0.000001){setError('The sum of batch quantities must equal Qty in OT now.');return;}if(form.track_batch&&form.opening_batches.some(row=>!row.batch_no.trim())){setError('Enter a Batch No for every opening batch.');return;}if(form.track_expiry&&form.opening_batches.some(row=>!row.expiry_date)){setError('Enter an Expiry Date for every opening batch.');return;}if(form.track_serial&&form.opening_batches.some(row=>!row.serial_no.trim()||Number(row.quantity)!==1)){setError('Each serial-tracked batch must have quantity 1 and its own Serial No.');return;}save.mutate();}} disabled={save.isPending}>{save.isPending?'Saving…':'Save Item'}</Button></DialogActions></Dialog>;
}
