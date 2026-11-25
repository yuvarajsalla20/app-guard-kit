import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from 'react-native';
import { useGuardLook } from '../context';
import { PinEntry } from './PinEntry';
import { GuardSurface, pinMessage, useHeader, useWaitLine } from './parts';

/** A PIN pad in a sheet over the app: to show amounts or to turn the lock off. */
export function PinSheet({ visible, title, subtitle, onSubmit, onClose, extraKey }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => Promise<string | null>;
  onClose: () => void;
  extraKey?: ReactNode;
}) {
  const { kit, strings } = useGuardLook();
  const waitLine = useWaitLine();
  const header = useHeader('tile');
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GuardSurface>
        <PinEntry
          header={header}
          title={title}
          subtitle={subtitle}
          length={kit.config.pinLength}
          blocked={waitLine}
          onSubmit={onSubmit}
          leftKey={{ label: strings.cancel, onPress: onClose }}
          footer={extraKey}
        />
      </GuardSurface>
    </Modal>
  );
}

/** Change PIN: current, new, new again. */
export function ChangePinSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { controller, strings, kit } = useGuardLook();
  const waitLine = useWaitLine();
  const header = useHeader('tile');
  const [step, setStep] = useState<'current' | 'new' | 'again'>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setStep('current');
      setCurrent('');
      setNext('');
      setNotice(null);
    }
  }, [visible]);
  const title = step === 'current' ? strings.currentPin : step === 'new' ? strings.newPin : strings.confirmNewPin;
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GuardSurface>
        <PinEntry
          resetKey={step}
          header={header}
          title={strings.changeTitle}
          subtitle={notice ?? title}
          length={kit.config.pinLength}
          blocked={step === 'current' ? waitLine : null}
          leftKey={{ label: strings.cancel, onPress: onClose }}
          onSubmit={async (pin) => {
            if (step === 'current') {
              // Checked again when saving; this early check gives the right message at once and counts wrong tries.
              const result = await controller.confirmPin(pin);
              if (result !== 'ok') return pinMessage(result, controller, strings);
              setCurrent(pin);
              setNotice(null);
              setStep('new');
              return null;
            }
            if (step === 'new') {
              const problem = controller.problemWith(pin);
              if (problem) return pinMessage(problem, controller, strings);
              setNext(pin);
              setStep('again');
              return null;
            }
            if (pin !== next) {
              setNotice(strings.mismatch);
              setStep('new');
              return null;
            }
            const result = await controller.changePin(current, pin);
            if (result !== 'ok') return pinMessage(result, controller, strings);
            onDone?.();
            onClose();
            return null;
          }}
        />
      </GuardSurface>
    </Modal>
  );
}

