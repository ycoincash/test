"use client";

import { UseFormReturn } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface GlobalReachStepProps {
  form: UseFormReturn<any>;
}

export function GlobalReachStep({ form }: GlobalReachStepProps) {
  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="globalReach.business_region"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <span className="ltr:inline hidden">Business Regions</span>
              <span className="rtl:inline hidden">مناطق العمل</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g., Europe, Asia, Middle East" {...field} value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''} onChange={(e) => field.onChange(e.target.value ? e.target.value.split(',').map((s: string) => s.trim()) : [])} />
            </FormControl>
            <FormDescription>
              <span className="ltr:inline hidden">Comma-separated list of regions</span>
              <span className="rtl:inline hidden">قائمة المناطق مفصولة بفواصل</span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="globalReach.global_presence"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <span className="ltr:inline hidden">Global Presence</span>
              <span className="rtl:inline hidden">التواجد العالمي</span>
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Describe the broker's global presence and market reach..."
                className="min-h-[100px]"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="globalReach.languages_supported"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <span className="ltr:inline hidden">Supported Languages</span>
              <span className="rtl:inline hidden">اللغات المدعومة</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g., English, Arabic, French, Spanish" {...field} value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''} onChange={(e) => field.onChange(e.target.value ? e.target.value.split(',').map((s: string) => s.trim()) : [])} />
            </FormControl>
            <FormDescription>
              <span className="ltr:inline hidden">Comma-separated list of languages</span>
              <span className="rtl:inline hidden">قائمة اللغات مفصولة بفواصل</span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="globalReach.customer_support_channels"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              <span className="ltr:inline hidden">Customer Support Channels</span>
              <span className="rtl:inline hidden">قنوات دعم العملاء</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="e.g., Live Chat, Email, Phone, WhatsApp" {...field} value={Array.isArray(field.value) ? field.value.join(', ') : field.value || ''} onChange={(e) => field.onChange(e.target.value ? e.target.value.split(',').map((s: string) => s.trim()) : [])} />
            </FormControl>
            <FormDescription>
              <span className="ltr:inline hidden">Comma-separated list of support channels</span>
              <span className="rtl:inline hidden">قائمة قنوات الدعم مفصولة بفواصل</span>
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
