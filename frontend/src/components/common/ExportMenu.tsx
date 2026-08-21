import { useState, type MouseEvent } from 'react';
import { Button, Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress } from '@mui/material';
import { FileDownloadOutlined, TableChartOutlined, DescriptionOutlined, PrintOutlined } from '@mui/icons-material';

interface ExportMenuProps {
  onExportExcel?: () => Promise<void> | void;
  onExportCsv?: () => Promise<void> | void;
  onExportPdf?: () => Promise<void> | void;
  onPrint?: () => void;
}

export function ExportMenu({ onExportExcel, onExportCsv, onExportPdf, onPrint }: ExportMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [busy, setBusy] = useState(false);

  const open = (e: MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const close = () => setAnchorEl(null);

  const run = async (fn?: () => Promise<void> | void) => {
    if (!fn) return;
    close();
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        onClick={open}
        startIcon={busy ? <CircularProgress size={16} /> : <FileDownloadOutlined fontSize="small" />}
        disabled={busy}
      >
        Export
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={close}>
        {onExportExcel && (
          <MenuItem onClick={() => run(onExportExcel)}>
            <ListItemIcon>
              <TableChartOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export to Excel</ListItemText>
          </MenuItem>
        )}
        {onExportCsv && (
          <MenuItem onClick={() => run(onExportCsv)}>
            <ListItemIcon>
              <TableChartOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export to CSV</ListItemText>
          </MenuItem>
        )}
        {onExportPdf && (
          <MenuItem onClick={() => run(onExportPdf)}>
            <ListItemIcon>
              <DescriptionOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Export to PDF</ListItemText>
          </MenuItem>
        )}
        {onPrint && (
          <MenuItem onClick={() => { close(); onPrint(); }}>
            <ListItemIcon>
              <PrintOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>Print</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
