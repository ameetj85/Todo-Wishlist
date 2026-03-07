"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = {
  children: React.ReactNode;
  pendingText: string;
  className?: string;
  disabled?: boolean;
};

export function SubmitButton({
  children,
  pendingText,
  className,
  disabled = false,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </Button>
  );
}
