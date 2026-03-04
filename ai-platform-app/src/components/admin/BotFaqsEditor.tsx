"use client";

import React, { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

export interface BotFaq {
  question: string;
  answer: string;
}

interface BotFaqsEditorProps {
  value: BotFaq[];
  onChange: (next: BotFaq[]) => void;
}

export default function BotFaqsEditor({ value, onChange }: BotFaqsEditorProps) {
  const [drafts, setDrafts] = useState<BotFaq[]>(value);

  function notify(rawFaqs: BotFaq[]) {
    const cleaned = rawFaqs
      .map((faq) => ({
        question: faq.question.trim(),
        answer: faq.answer.trim(),
      }))
      .filter((faq) => faq.question && faq.answer);
    onChange(cleaned);
  }

  function addFaq() {
    const next = [...drafts, { question: "", answer: "" }];
    setDrafts(next);
    notify(next);
  }

  function updateFaq(index: number, partial: Partial<BotFaq>) {
    const next = drafts.map((faq, i) => {
      if (i !== index) return faq;
      return {
        question:
          partial.question !== undefined ? partial.question.trimStart() : faq.question.trimStart(),
        answer: partial.answer !== undefined ? partial.answer.trimStart() : faq.answer.trimStart(),
      };
    });
    setDrafts(next);
    notify(next);
  }

  function removeFaq(index: number) {
    const next = drafts.filter((_, i) => i !== index);
    setDrafts(next);
    notify(next);
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">FAQs</h3>
        <p className="text-xs text-gray-500">Add common questions and answers the bot can use.</p>
      </div>

      {drafts.map((faq, index) => (
        <div key={index} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
          <div>
            <span className="text-xs text-gray-500">Question</span>
            <Input
              value={faq.question}
              onChange={(event) => updateFaq(index, { question: event.target.value })}
              placeholder="e.g. What services do you offer?"
              className="border-gray-300 bg-white focus-visible:ring-brand-400/40"
            />
          </div>
          <div>
            <span className="text-xs text-gray-500">Answer</span>
            <Textarea
              rows={3}
              value={faq.answer}
              onChange={(event) => updateFaq(index, { answer: event.target.value })}
              placeholder="Short, clear answer for this FAQ."
              className="border-gray-300 bg-white focus-visible:ring-brand-400/40"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => removeFaq(index)}>
              Remove
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" size="sm" onClick={addFaq}>
        Add FAQ
      </Button>
    </section>
  );
}
