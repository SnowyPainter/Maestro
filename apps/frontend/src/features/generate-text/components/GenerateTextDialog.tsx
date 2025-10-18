import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { useGenerateTextStore } from '@/store/generate-text';
import { Loader2 } from 'lucide-react';
import { useCoworkerGenerateTextApiOrchestratorHelpersCoworkerGenerateTextPost } from '@/lib/api/generated';

const formSchema = z.object({
  prompt: z.string().min(1, "Prompt cannot be empty."),
});

// Helper to set value on a React-controlled input
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value')?.set;
  if (!valueSetter) {
    element.value = value; // Fallback
    return;
  }
  valueSetter.call(element, value);

  // For React 16+ to recognize the change, we need to dispatch both events.
  const inputEvent = new Event('input', { bubbles: true });
  const changeEvent = new Event('change', { bubbles: true });

  element.dispatchEvent(inputEvent);
  element.dispatchEvent(changeEvent);
}

export function GenerateTextDialog() {
  const { isOpen, close, originalElement, title } = useGenerateTextStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const mutation = useCoworkerGenerateTextApiOrchestratorHelpersCoworkerGenerateTextPost();

  const form = useForm<{ prompt: string }>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: "" },
    mode: 'onChange', // To enable formState.isValid
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      (window as any).isGeneratingText = false;
      close();
    }
  };

  const handleSubmit = (values: { prompt: string }) => {
    console.log("handleSubmit called with values:", values);
    console.log("originalElement:", originalElement);

    if (!originalElement) {
      console.error("No original element found");
      return;
    }

    console.log("Calling mutation.mutate with:", { data: { text: values.prompt } });

    setError(null); // Clear any previous error

    mutation.mutate({ data: { text: values.prompt } }, {
      onSuccess: (data) => {
        console.log("Mutation success:", data);
        if (originalElement) {
          const blockId = (originalElement as HTMLElement).dataset.blockId;

          if (blockId) {
            // This is a TextBlock from DraftIREditor
            const expandEvent = new CustomEvent('expand-text-block', { detail: { blockId } });
            window.dispatchEvent(expandEvent);

            setTimeout(() => {
              const newElement = document.querySelector(`textarea[data-block-id="${blockId}"]`);
              if (newElement) {
                setNativeValue(newElement as HTMLTextAreaElement, data.text);
                (newElement as HTMLTextAreaElement).focus();
              }
              (window as any).isGeneratingText = false;
              close();
            }, 100); // Give it a moment to re-render
          } else {
            // This is a normal input/textarea
            setNativeValue(originalElement, data.text);
            originalElement.focus();
            (window as any).isGeneratingText = false;
            close();
          }
        }
      },
      onError: (error) => {
        console.error("Failed to generate text:", error);
        (window as any).isGeneratingText = false;
        setError(error?.detail?.[0]?.msg || "Failed to generate text. Please try again.");
      }
    });
  };
  
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      form.reset();
      setError(null); // Clear error when dialog opens
    }
  }, [isOpen, form]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      ref={inputRef}
                      placeholder="Enter a prompt to generate text..."
                      autoComplete="off"
                    />
                  </FormControl>
                  <FormMessage />
                  {error && (
                    <div className="text-sm text-red-500 mt-1">
                      {error}
                    </div>
                  )}
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isValid || mutation.isPending}>
                {mutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  "Generate"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
