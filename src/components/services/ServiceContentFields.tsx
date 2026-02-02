import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/slugify";
import type { ServiceFormData } from "./types";

interface ServiceContentFieldsProps {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
  locale: "no" | "en" | "sv";
}

export function ServiceContentFields({ formData, setFormData, locale }: ServiceContentFieldsProps) {
  const handleNameChange = (value: string) => {
    if (locale === "no") {
      setFormData(prev => ({
        ...prev,
        name: value,
        slug: slugify(value),
      }));
    } else if (locale === "en") {
      setFormData(prev => ({
        ...prev,
        name_en: value,
        slug_en: slugify(value),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        name_sv: value,
        slug_sv: slugify(value),
      }));
    }
  };

  // Get field values based on locale
  const suffix = locale === "no" ? "" : `_${locale}`;
  const getField = (base: string) => (formData as any)[base + suffix] || "";
  const setField = (base: string, value: string) => {
    const key = base + suffix;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const localeLabel = locale === "no" ? "" : ` (${locale.toUpperCase()})`;
  const isRequired = locale === "no";

  return (
    <div className="space-y-4">
      {/* Name and Slug */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`name${suffix}`}>Name{localeLabel} {isRequired && "*"}</Label>
          <Input
            id={`name${suffix}`}
            value={getField("name")}
            onChange={(e) => handleNameChange(e.target.value)}
            required={isRequired}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`slug${suffix}`}>Slug{localeLabel} {isRequired && "*"}</Label>
          <Input
            id={`slug${suffix}`}
            value={getField("slug")}
            onChange={(e) => setField("slug", e.target.value)}
            required={isRequired}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor={`description${suffix}`}>Description{localeLabel}</Label>
        <Textarea
          id={`description${suffix}`}
          value={getField("description")}
          onChange={(e) => setField("description", e.target.value)}
          rows={3}
        />
      </div>

      {/* Short Description */}
      <div className="space-y-2">
        <Label htmlFor={`short_description${suffix}`}>Short Description{localeLabel}</Label>
        <Input
          id={`short_description${suffix}`}
          value={getField("short_description")}
          onChange={(e) => setField("short_description", e.target.value)}
          placeholder="Brief one-liner for listings..."
        />
      </div>

      {/* Intro Content (Rich Text for SEO) */}
      <div className="space-y-2">
        <Label htmlFor={`intro${suffix}`}>Intro Content{localeLabel}</Label>
        <Textarea
          id={`intro${suffix}`}
          value={getField("intro")}
          onChange={(e) => setField("intro", e.target.value)}
          rows={3}
          placeholder="Rich intro content for SEO..."
        />
      </div>

      {/* Service Includes (Rich Text) */}
      <div className="space-y-2">
        <Label htmlFor={`service_includes${suffix}`}>Service Includes{localeLabel}</Label>
        <Textarea
          id={`service_includes${suffix}`}
          value={getField("service_includes")}
          onChange={(e) => setField("service_includes", e.target.value)}
          rows={3}
          placeholder="What's included in this service..."
        />
      </div>

      {/* SEO Fields */}
      <div className="space-y-2">
        <Label htmlFor={`seo_title${suffix}`}>SEO Title{localeLabel}</Label>
        <Input
          id={`seo_title${suffix}`}
          value={getField("seo_title")}
          onChange={(e) => setField("seo_title", e.target.value)}
          placeholder="Page title for search engines..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`seo_meta_description${suffix}`}>SEO Meta Description{localeLabel}</Label>
        <Textarea
          id={`seo_meta_description${suffix}`}
          value={getField("seo_meta_description")}
          onChange={(e) => setField("seo_meta_description", e.target.value)}
          rows={2}
          placeholder="Meta description for search engines..."
        />
      </div>
    </div>
  );
}
