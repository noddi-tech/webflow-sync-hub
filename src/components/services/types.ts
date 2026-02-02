// Types for Services form and data
export interface ServiceFormData {
  // Core fields
  name: string;
  name_en: string;
  name_sv: string;
  slug: string;
  slug_en: string;
  slug_sv: string;
  description: string;
  description_en: string;
  description_sv: string;
  short_description: string;
  short_description_en: string;
  short_description_sv: string;
  
  // SEO fields
  seo_title: string;
  seo_title_en: string;
  seo_title_sv: string;
  seo_meta_description: string;
  seo_meta_description_en: string;
  seo_meta_description_sv: string;
  intro: string;
  intro_en: string;
  intro_sv: string;
  service_includes: string;
  service_includes_en: string;
  service_includes_sv: string;
  
  // Pricing fields
  price: string;
  price_from: string;
  price_first_column: string;
  price_first_column_en: string;
  price_first_column_sv: string;
  price_second_column: string;
  price_second_column_en: string;
  price_second_column_sv: string;
  price_third_column: string;
  price_third_column_en: string;
  price_third_column_sv: string;
  
  // Steps fields
  step_1_text: string;
  step_1_text_en: string;
  step_1_text_sv: string;
  step_1_illustration: string;
  step_2_text: string;
  step_2_text_en: string;
  step_2_text_sv: string;
  step_2_illustration: string;
  step_3_text: string;
  step_3_text_en: string;
  step_3_text_sv: string;
  step_3_illustration: string;
  
  // Control fields
  icon_url: string;
  sort_order: number;
  active: boolean;
  season_product: boolean;
  service_type_schema: string;
  service_category_id: string | null;
}

export const emptyServiceFormData: ServiceFormData = {
  name: "",
  name_en: "",
  name_sv: "",
  slug: "",
  slug_en: "",
  slug_sv: "",
  description: "",
  description_en: "",
  description_sv: "",
  short_description: "",
  short_description_en: "",
  short_description_sv: "",
  seo_title: "",
  seo_title_en: "",
  seo_title_sv: "",
  seo_meta_description: "",
  seo_meta_description_en: "",
  seo_meta_description_sv: "",
  intro: "",
  intro_en: "",
  intro_sv: "",
  service_includes: "",
  service_includes_en: "",
  service_includes_sv: "",
  price: "",
  price_from: "",
  price_first_column: "",
  price_first_column_en: "",
  price_first_column_sv: "",
  price_second_column: "",
  price_second_column_en: "",
  price_second_column_sv: "",
  price_third_column: "",
  price_third_column_en: "",
  price_third_column_sv: "",
  step_1_text: "",
  step_1_text_en: "",
  step_1_text_sv: "",
  step_1_illustration: "",
  step_2_text: "",
  step_2_text_en: "",
  step_2_text_sv: "",
  step_2_illustration: "",
  step_3_text: "",
  step_3_text_en: "",
  step_3_text_sv: "",
  step_3_illustration: "",
  icon_url: "",
  sort_order: 0,
  active: true,
  season_product: false,
  service_type_schema: "",
  service_category_id: null,
};
