import React, { useState } from 'react';
import { CHECK_CONSENT_BY_DEFAULT } from '../payments/settings';

interface Props {
  onChange: (checked: boolean) => void;
  label?: string;
}

// Card consent gate. Wallets skip this when WALLET_REQUIRE_CONSENT is false.
export default function ConsentCheckboxes({ onChange, label }: Props) {
  const [checked, setChecked] = useState<boolean>(CHECK_CONSENT_BY_DEFAULT);
  return (
    <label className="consent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          setChecked(e.target.checked);
          onChange(e.target.checked);
        }}
      />
      <span>
        {label ||
          'I agree to the Terms & Conditions and authorize the recurring subscription described above.'}
      </span>
    </label>
  );
}
