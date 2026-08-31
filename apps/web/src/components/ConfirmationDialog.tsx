import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogProps,
  DialogTitle,
} from "@mui/material";
import { makeStyles } from "@mui/styles";

const useStyles = makeStyles(() => ({
  dialogActions: {
    paddingTop: 0,
  },
  dialogContent: {
    paddingTop: 0,
  },
  text: {
    // Preserve newlines
    whiteSpace: "pre-line",
  },
}));

export interface ConfirmationDialogProps {
  title?: string;
  body?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  handleConfirm: () => void;
  open: boolean;
  handleClose: () => void;
  dialogProps?: Partial<DialogProps>;
}

const ConfirmationDialog = ({
  title = "Are you sure?",
  body = "This action is irreversible!",
  confirmButtonText = "Confirm",
  cancelButtonText = "Cancel",
  handleConfirm,
  open,
  handleClose,
  dialogProps,
}: ConfirmationDialogProps) => {
  const classes = useStyles();

  return (
    <>
      <Dialog
        {...dialogProps}
        open={open}
        onClose={(_, reason) => {
          if (reason === "backdropClick" || reason === "escapeKeyDown") {
            return;
          }

          handleClose();
        }}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{title}</DialogTitle>

        <DialogContent className={classes.dialogContent}>
          <DialogContentText
            className={classes.text}
            sx={{ marginBottom: body ? 2 : undefined }}
          >
            {body}
          </DialogContentText>
        </DialogContent>

        <DialogActions className={classes.dialogActions}>
          <Button onClick={handleClose} autoFocus>
            {cancelButtonText}
          </Button>
          <Button
            onClick={() => {
              handleClose();
              handleConfirm();
            }}
          >
            {confirmButtonText}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfirmationDialog;
