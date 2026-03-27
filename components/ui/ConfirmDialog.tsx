"use client";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message?: string;
  loading?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, message = "Bu işlemi yapmak istediğinizden emin misiniz?", loading }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Onay">
      <p className="text-brown-700 mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>İptal</Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>{loading ? "Siliniyor..." : "Sil"}</Button>
      </div>
    </Modal>
  );
}
