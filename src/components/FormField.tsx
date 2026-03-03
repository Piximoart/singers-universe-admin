"use client";

import { cn } from "@/lib/cn";

interface BaseProps {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

interface InputProps extends BaseProps {
  type: "text" | "number" | "date" | "url" | "email";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface TextareaProps extends BaseProps {
  type: "textarea";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

interface SelectProps extends BaseProps {
  type: "select";
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

interface ToggleProps extends BaseProps {
  type: "toggle";
  value: boolean;
  onChange: (value: boolean) => void;
}

interface ColorProps extends BaseProps {
  type: "color";
  value: string;
  onChange: (value: string) => void;
}

type FormFieldProps = InputProps | TextareaProps | SelectProps | ToggleProps | ColorProps;

export default function FormField(props: FormFieldProps) {
  const inputClass =
    "w-full bg-s2 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white placeholder:text-sub focus:outline-none focus:border-lime transition-colors";

  return (
    <div className={cn("space-y-1.5", props.className)}>
      <label className="block text-sm font-medium text-white">
        {props.label}
        {props.required && <span className="text-red-400 ml-1">*</span>}
      </label>

      {props.type === "textarea" ? (
        <textarea
          name={props.name}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 4}
          required={props.required}
          className={cn(inputClass, "resize-y")}
        />
      ) : props.type === "select" ? (
        <select
          name={props.name}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          required={props.required}
          className={inputClass}
        >
          <option value="">Vyberte...</option>
          {props.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : props.type === "toggle" ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => props.onChange(!props.value)}
            className={cn(
              "relative w-10 h-6 rounded-full transition-colors",
              props.value ? "bg-lime" : "bg-s4"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                props.value ? "translate-x-5" : "translate-x-1"
              )}
            />
          </button>
          <span className="text-sm text-sub">{props.value ? "Ano" : "Ne"}</span>
        </div>
      ) : props.type === "color" ? (
        <div className="flex items-center gap-2">
          <div className="relative shrink-0">
            <div
              className="w-10 h-10 rounded-md border border-white/10 cursor-pointer"
              style={{ backgroundColor: props.value || "#000000" }}
            />
            <input
              type="color"
              value={props.value || "#000000"}
              onChange={(e) => props.onChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <input
            type="text"
            name={props.name}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder="#000000"
            required={props.required}
            className={cn(inputClass, "font-mono uppercase")}
          />
        </div>
      ) : (
        <input
          type={props.type}
          name={props.name}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          required={props.required}
          className={inputClass}
        />
      )}

      {props.hint && <p className="text-xs text-sub">{props.hint}</p>}
      {props.error && <p className="text-xs text-red-400">{props.error}</p>}
    </div>
  );
}
