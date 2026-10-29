'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelByClientAction, reviewAction } from './actions';
import { Button, Textarea } from '@/components/ui/basic';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/interactive';
import { useToast } from '@/components/toast';

export function CancelButton({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <>
      <Button variant="danger" icon="x" onClick={() => setOpen(true)}>
        Cancelar horário
      </Button>
      {open ? (
        <Modal
          title="Cancelar este horário?"
          eyebrow="Confirmação"
          danger
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Manter</Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await cancelByClientAction(token);
                  setBusy(false);
                  setOpen(false);
                  toast(r.ok ? 'success' : 'error', r.ok ? 'Horário cancelado.' : r.error!);
                  router.refresh();
                }}
              >
                {busy ? 'Cancelando...' : 'Cancelar horário'}
              </Button>
            </>
          }
        >
          O horário fica livre para outra pessoa.
        </Modal>
      ) : null}
    </>
  );
}

export function ReviewForm({ token }: { token: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  return (
    <div className="stack">
      <div className="rating-pick" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>
            <Icon name={n <= rating ? 'star-solid' : 'star'} size={22} />
          </button>
        ))}
      </div>
      <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Conte como foi (opcional)" aria-label="Comentário" />
      <Button
        disabled={!rating || busy}
        onClick={async () => {
          setBusy(true);
          const r = await reviewAction({ token, rating, comment });
          setBusy(false);
          toast(r.ok ? 'success' : 'error', r.ok ? 'Avaliação enviada. Obrigado!' : r.error!);
          router.refresh();
        }}
      >
        {busy ? 'Enviando...' : 'Enviar avaliação'}
      </Button>
    </div>
  );
}
