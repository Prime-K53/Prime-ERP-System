import { dbService } from './db';

const uuidv4 = () => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export interface WhatsAppChat {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageAt: string;
  status: 'unread' | 'read' | 'archived';
  priority: 'high' | 'normal' | 'low';
  assignedTo?: string;
  tags: string[];
  messages: WhatsAppMessage[];
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppMessage {
  id: string;
  chatId: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'template';
  direction: 'inbound' | 'outbound';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  mediaUrl?: string;
  templateId?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  subcategory: string;
  variables: string[];
  status: 'active' | 'draft' | 'archived';
  usageCount: number;
  createdAt: string;
  isPreloaded: boolean;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  description: string;
  templateId?: string;
  message: string;
  recipients: string[];
  recipientCount: number;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  scheduledAt?: string;
  sentAt?: string;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  cost: number;
  createdAt: string;
  createdBy: string;
}

export interface AutomationFlow {
  id: string;
  name: string;
  description: string;
  trigger: string;
  triggerType: 'keyword' | 'new_customer' | 'inquiry' | 'purchase' | 'appointment' | 'custom';
  steps: AutomationStep[];
  status: 'active' | 'paused' | 'draft';
  stats: { triggered: number; completed: number; lastTriggered?: string };
  createdAt: string;
  updatedAt: string;
}

export interface AutomationStep {
  id: string;
  order: number;
  type: 'message' | 'wait' | 'condition' | 'action' | 'tag';
  config: Record<string, any>;
  delay?: number;
}

const MARKETING_TEMPLATES: WhatsAppTemplate[] = [
  // ==================== QUOTES ====================
  { id: 'tpl-quote-1', name: 'Quote Request Acknowledged', content: 'Hi {{name}}! Thanks for your printing inquiry at {{company}}. We\'re reviewing your request for {{product}} ({{quantity}} pcs, {{finishing}}, {{size}}). We\'ll send a detailed quote within 24 hours!', category: 'Quote', subcategory: 'Request', variables: ['name', 'company', 'product', 'quantity', 'finishing', 'size'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-quote-2', name: 'Quote Ready', content: 'Hi {{name}}! Your print quote #{{quoteId}} from {{company}} is ready. {{product}} — {{quantity}} units — {{amount}}. Includes {{finishing}}, {{paper}}, and delivery. Valid for {{days}} days. Reply ACCEPT to confirm or ask questions!', category: 'Quote', subcategory: 'Sent', variables: ['name', 'company', 'quoteId', 'product', 'quantity', 'amount', 'finishing', 'paper', 'days'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-quote-3', name: 'Quote Follow-up', content: 'Hi {{name}}! Just following up on your quote #{{quoteId}} for {{product}}. We\'d love to help bring your project to life. The pricing is valid until {{date}}. Reply with any questions or to proceed!', category: 'Quote', subcategory: 'Follow-up', variables: ['name', 'quoteId', 'product', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-quote-4', name: 'Quote Accepted', content: 'Awesome {{name}}! Your quote #{{quoteId}} is accepted. We\'ll start pre-flighting your files and will be in touch shortly. Thanks for choosing {{company}}!', category: 'Quote', subcategory: 'Accepted', variables: ['name', 'quoteId', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-quote-5', name: 'Bulk Quote Request', content: 'Hi {{name}}! You requested a bulk print quote at {{company}}. For {{quantity}}+ units of {{product}}, we can offer {{discount}}% off our standard rates. Let us know your specs and we\'ll price it out!', category: 'Quote', subcategory: 'Bulk', variables: ['name', 'company', 'quantity', 'product', 'discount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-quote-6', name: 'Quote Expiring Soon', content: 'Quick heads up {{name}}! Your quote #{{quoteId}} for {{product}} at {{company}} expires in {{days}} days. Prices are based on current paper costs. Reply to lock in before it expires!', category: 'Quote', subcategory: 'Expiring', variables: ['name', 'quoteId', 'product', 'company', 'days'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== ORDERS ====================
  { id: 'tpl-order-1', name: 'Order Confirmed', content: '✅ Order confirmed, {{name}}! #{{orderId}} — {{product}} ({{quantity}}) at {{company}}. Your files have passed pre-flight. We\'ll begin production on {{date}} and keep you posted!', category: 'Orders', subcategory: 'Confirmation', variables: ['name', 'orderId', 'product', 'quantity', 'company', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-2', name: 'In Production', content: '{{name}}, your order #{{orderId}} is now on press! {{color}} printing on {{paper}} with {{finishing}}. Estimated completion: {{date}}. We\'ll send a photo once it comes off the press!', category: 'Orders', subcategory: 'Production', variables: ['name', 'orderId', 'color', 'paper', 'finishing', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-3', name: 'Quality Check Passed', content: '✅ Quality check passed for order #{{orderId}}! Your {{product}} looks fantastic — colors are spot on, registration is perfect. Moving to finishing ({{finishing}}). Almost ready!', category: 'Orders', subcategory: 'Quality Check', variables: ['name', 'orderId', 'product', 'finishing'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-4', name: 'Ready for Pickup', content: '📦 Ready for pickup, {{name}}! Your order #{{orderId}} from {{company}} is printed, finished, and waiting. We\'re open {{hours}}. Bring your order number. See you soon!', category: 'Orders', subcategory: 'Pickup', variables: ['name', 'orderId', 'company', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-5', name: 'Order Shipped', content: '🚚 Shipped, {{name}}! Order #{{orderId}} is on its way via {{carrier}}. Tracking: {{trackingUrl}}. Est. delivery: {{date}}. Please inspect on arrival and let us know if anything needs attention!', category: 'Orders', subcategory: 'Shipped', variables: ['name', 'orderId', 'carrier', 'trackingUrl', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-6', name: 'Order Delivered', content: '🎉 Delivered, {{name}}! Order #{{orderId}} should be with you. We hope your {{product}} exceeds expectations. If anything isn\'t perfect, reply within {{days}} days and we\'ll make it right!', category: 'Orders', subcategory: 'Delivered', variables: ['name', 'orderId', 'product', 'days'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-7', name: 'Urgent Order Update', content: '{{name}}, great news! We\'ve expedited your rush order #{{orderId}} for {{product}}. Your prints are ahead of schedule — expect completion by {{date}} instead of {{originalDate}}!', category: 'Orders', subcategory: 'Urgent', variables: ['name', 'orderId', 'product', 'date', 'originalDate'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-8', name: 'Order Delay Notice', content: 'Hi {{name}}, an update on order #{{orderId}}. We\'re experiencing a slight delay due to {{reason}}. Revised completion: {{newDate}}. We apologize and will prioritize your order. Reply with any concerns!', category: 'Orders', subcategory: 'Delay', variables: ['name', 'orderId', 'reason', 'newDate'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-9', name: 'Large Order Progress', content: '{{name}}, progress update on your large order #{{orderId}}: {{percent}}% complete. {{quantity}} of {{total}} units printed. On track for completion by {{date}}. We\'ll stage delivery in batches if preferred!', category: 'Orders', subcategory: 'Progress', variables: ['name', 'orderId', 'percent', 'quantity', 'total', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-order-10', name: 'Reprint Confirmed', content: '✅ Reprint confirmed, {{name}}! Order #{{orderId}} for {{product}} is back in production with corrections applied. We\'ll prioritize this — est. completion {{date}}. Sorry for the inconvenience!', category: 'Orders', subcategory: 'Reprint', variables: ['name', 'orderId', 'product', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== DESIGN & PROOF ====================
  { id: 'tpl-design-1', name: 'Design Consultation Scheduled', content: '{{name}}, your design consultation at {{company}} is set for {{date}} at {{time}}. We\'ll discuss {{project}} — bring your ideas, brand assets, and any reference materials. See you then!', category: 'Design & Proof', subcategory: 'Consultation', variables: ['name', 'company', 'date', 'time', 'project'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-design-2', name: 'Design Mockup Ready', content: '{{name}}, your design mockup for {{product}} is ready! View here: {{link}}. We\'ve used {{colors}} and {{style}} based on your brief. Let us know your thoughts or request tweaks!', category: 'Design & Proof', subcategory: 'Mockup', variables: ['name', 'product', 'link', 'colors', 'style'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-design-3', name: 'Proof for Review', content: '📐 Proof ready, {{name}}! Your {{product}} proof #{{proofId}} is available at {{link}}. Please check: text, colors, images, and bleed. Reply APPROVED to send to print or list your revisions!', category: 'Design & Proof', subcategory: 'Proof Ready', variables: ['name', 'product', 'proofId', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-design-4', name: 'Revisions Requested', content: 'Got it {{name}}! We\'ve noted your revision requests for {{product}} proof #{{proofId}}: {{changes}}. We\'ll update and send the next version within {{hours}} hours.', category: 'Design & Proof', subcategory: 'Revision', variables: ['name', 'product', 'proofId', 'changes', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-design-5', name: 'Proof Approved — To Press', content: '🎉 Proof approved, {{name}}! We\'re sending {{product}} to press now. Final specs: {{quantity}} on {{paper}} with {{finishing}}. Estimated completion: {{date}}. We\'ll send a press check photo!', category: 'Design & Proof', subcategory: 'Approved', variables: ['name', 'product', 'quantity', 'paper', 'finishing', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-design-6', name: 'Artwork Check Required', content: 'Hi {{name}}! Our pre-flight check found some issues with your file for order #{{orderId}}: {{issues}} (e.g., low-res images, missing bleed, wrong color space). Please send updated artwork. Happy to help if needed!', category: 'Design & Proof', subcategory: 'Artwork Check', variables: ['name', 'orderId', 'issues'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== PROMOTIONS ====================
  { id: 'tpl-promo-1', name: 'Business Card Special', content: '🔥 Business card special at {{company}}! {{quantity}} premium full-color business cards on 14pt stock with glossy UV — just {{price}}! Design included. Offer valid {{date}}. Reply to order!', category: 'Promotions', subcategory: 'Business Cards', variables: ['name', 'company', 'quantity', 'price', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-2', name: 'Flyer Printing Sale', content: '📢 Flyer sale at {{company}}! {{quantity}} full-color flyers on 100lb gloss text for only {{price}}. Perfect for events, sales, and promotions. Design service available. Valid until {{date}}!', category: 'Promotions', subcategory: 'Flyers', variables: ['name', 'company', 'quantity', 'price', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-3', name: 'Banner Printing Promo', content: '🏗️ Banner promo at {{company}}! Weather-resistant vinyl banners — {{size}} for just {{price}}. Full color, hemmed edges, grommets included. Perfect for storefronts, events, and grand openings!', category: 'Promotions', subcategory: 'Banners', variables: ['name', 'company', 'size', 'price'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-4', name: 'Brochure Discount', content: '📘 Brochure deal at {{company}}! Get {{quantity}} tri-fold brochures on premium paper for {{price}}. Full color both sides, gloss or matte finish. Great for your business or event marketing!', category: 'Promotions', subcategory: 'Brochures', variables: ['name', 'company', 'quantity', 'price'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-5', name: 'Sticker Printing Deal', content: '🖼️ Custom sticker sale at {{company}}! Die-cut, kiss-cut, or shape — waterproof vinyl stickers starting at {{price}} for {{quantity}}. Gloss or matte. Perfect for branding and packaging!', category: 'Promotions', subcategory: 'Stickers', variables: ['name', 'company', 'price', 'quantity'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-6', name: 'Seasonal Printing Sale', content: '🎄 {{season}} specials at {{company}}! Order {{product}} by {{date}} and get {{discount}}% off + free design. Great for {{occasion}}. Reply to get started or request samples!', category: 'Promotions', subcategory: 'Seasonal', variables: ['name', 'company', 'season', 'product', 'date', 'discount', 'occasion'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-7', name: 'New Service Announcement', content: '🆕 Now available at {{company}}: {{newService}}! {{description}}. Introductory pricing — {{promo}}. Reply to learn more or book your first job at the promo rate!', category: 'Promotions', subcategory: 'New Service', variables: ['name', 'company', 'newService', 'description', 'promo'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-8', name: 'Bulk Discount Offer', content: '📦 Go big and save at {{company}}! Orders over {{quantity}} units get {{discount}}% off. Over {{largerQuantity}} units get {{largerDiscount}}% off. Perfect for chains, franchises, and events. Reply for a bulk quote!', category: 'Promotions', subcategory: 'Bulk Discount', variables: ['name', 'company', 'quantity', 'discount', 'largerQuantity', 'largerDiscount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-9', name: 'Referral Discount', content: '🤝 Know someone who needs printing? Refer them to {{company}} and you get {{reward}} credit PLUS they get {{bonus}} off their first order. Share your referral code: {{code}}.', category: 'Promotions', subcategory: 'Referral', variables: ['name', 'company', 'reward', 'bonus', 'code'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-10', name: 'First Order Welcome Discount', content: '👋 Welcome offer, {{name}}! Enjoy {{discount}}% off your first print order at {{company}}. Any product — business cards, flyers, banners, or brochures. Use code {{code}} on checkout. Valid {{date}}!', category: 'Promotions', subcategory: 'First Order', variables: ['name', 'company', 'discount', 'code', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-11', name: 'Loyalty Customer Offer', content: '🌟 You\'re a valued repeat customer, {{name}}! As our thanks, here\'s {{discount}}% off your next order at {{company}}. No minimum — whether it\'s 50 business cards or 5000 flyers. Code: {{code}}. Expires {{date}}!', category: 'Promotions', subcategory: 'Loyalty', variables: ['name', 'company', 'discount', 'code', 'date'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-promo-12', name: 'Grand Opening Flyer Deal', content: '🎉 Opening a new location? {{company}} can help! {{quantity}} grand opening flyers + {{quantity}} banners for {{packagePrice}}. Full design included. Make a big splash! Reply to customize your package!', category: 'Promotions', subcategory: 'Grand Opening', variables: ['name', 'company', 'quantity', 'packagePrice'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== FOLLOW-UP ====================
  { id: 'tpl-follow-1', name: 'Reorder Reminder', content: '⏰ Hi {{name}}! It\'s probably time to restock your {{product}} from {{company}}. We still have your print-ready files on file — we can reprint the exact same or update the content. Reply to reorder!', category: 'Follow-up', subcategory: 'Reorder', variables: ['name', 'company', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-2', name: 'Satisfaction Check', content: '⭐ Hi {{name}}! How are your prints from {{company}} holding up? We\'d love to hear your feedback — reply with a photo or a quick rating. Happy customers help us improve!', category: 'Follow-up', subcategory: 'Satisfaction', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-3', name: 'Review Request', content: '📝 {{name}}, loved your {{product}} from {{company}}? Please leave us a review at {{reviewLink}}. As a thank you, reply with your review screenshot and we\'ll send a {{reward}} discount code!', category: 'Follow-up', subcategory: 'Review', variables: ['name', 'product', 'company', 'reviewLink', 'reward'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-4', name: 'Re-engagement', content: '👋 Haven\'t seen you in a while, {{name}}! We miss printing for you. Here\'s {{discount}}% off your next order at {{company}} — code {{code}}. New products, finishes, and services available now!', category: 'Follow-up', subcategory: 'Re-engagement', variables: ['name', 'company', 'discount', 'code'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-5', name: 'New Product Suggestion', content: '💡 {{name}}, based on your previous orders, you might like our new {{product}} service. {{description}}. Reply to see samples or request a quote for your next project!', category: 'Follow-up', subcategory: 'Suggestion', variables: ['name', 'product', 'description'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-6', name: 'Project Check-in', content: '📋 Hi {{name}}! Checking in on your print project. Need any help with {{product}} artwork or specs? We\'re here to help with design, paper selection, and finishing options. Reply anytime!', category: 'Follow-up', subcategory: 'Project Check', variables: ['name', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-7', name: 'Customer Anniversary', content: '🎉 It\'s been {{years}} year(s) since your first order with {{company}}, {{name}}! Thank you for trusting us with your printing. Enjoy {{discount}}% off your next order — code {{code}}. Here\'s to many more!', category: 'Follow-up', subcategory: 'Anniversary', variables: ['name', 'company', 'years', 'discount', 'code'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-follow-8', name: 'Print Care Tips', content: '💡 Quick tip for your {{product}}, {{name}}: keep them in a cool, dry place away from direct sunlight to maintain color vibrancy. For laminated prints, wipe clean with a soft cloth. Need a reprint? Reply anytime!', category: 'Follow-up', subcategory: 'Care Tips', variables: ['name', 'product'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== BILLING ====================
  { id: 'tpl-billing-1', name: 'Invoice Ready', content: '📄 Invoice #{{invoiceId}} from {{company}} is ready. {{product}} — {{amount}}. Due by {{dueDate}}. Pay via: {{paymentMethods}}. View invoice: {{link}}. Reply if you have questions!', category: 'Billing', subcategory: 'Invoice', variables: ['name', 'company', 'invoiceId', 'product', 'amount', 'dueDate', 'paymentMethods', 'link'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-2', name: 'Payment Reminder', content: '⏰ Friendly reminder, {{name}}! Invoice #{{invoiceId}} for {{amount}} is due on {{dueDate}}. We accept bank transfer, credit card, and PayPal. Pay here: {{paymentLink}}. Thanks for your prompt payment!', category: 'Billing', subcategory: 'Reminder', variables: ['name', 'invoiceId', 'amount', 'dueDate', 'paymentLink'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-3', name: 'Payment Received', content: '✅ Payment received, {{name}}! Thank you for your payment of {{amount}} for invoice #{{invoiceId}}. Receipt: {{receiptLink}}. Your prints have been released for production/shipping. Appreciate your business!', category: 'Billing', subcategory: 'Receipt', variables: ['name', 'amount', 'invoiceId', 'receiptLink'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-4', name: 'Deposit Request', content: 'Hi {{name}}! To start production on order #{{orderId}}, we require a {{percent}}% deposit of {{amount}}. Pay here: {{paymentLink}}. Once confirmed, we\'ll begin printing immediately. Balance due before shipping.', category: 'Billing', subcategory: 'Deposit', variables: ['name', 'orderId', 'percent', 'amount', 'paymentLink'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-billing-5', name: 'Overdue Notice', content: '⚠️ Overdue notice, {{name}}! Invoice #{{invoiceId}} ({{amount}}) was due {{dueDate}}. To avoid any production delays on future orders, please remit payment at {{paymentLink}}. Reply if you need to discuss terms!', category: 'Billing', subcategory: 'Overdue', variables: ['name', 'invoiceId', 'amount', 'dueDate', 'paymentLink'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== WELCOME ====================
  { id: 'tpl-welcome-1', name: 'New Customer Welcome', content: '👋 Welcome to {{company}}, {{name}}! We\'re your full-service print partner. Upload your artwork or tell us about your project — we handle everything from design to delivery. How can we help you today?', category: 'Welcome', subcategory: 'New Customer', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-2', name: 'Welcome — Services Overview', content: '🎨 Here\'s what we do at {{company}}, {{name}}: business cards, flyers, brochures, banners, stickers, labels, packaging, signage, wide format, and custom finishing. Reply with what you need and we\'ll get a quote ready!', category: 'Welcome', subcategory: 'Services', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-3', name: 'First Order Guide', content: '📋 New to ordering at {{company}}, {{name}}? Here\'s the process: 1) Tell us what you need, 2) We quote within 24h, 3) Upload artwork or use our design service, 4) Approve proof, 5) We print & deliver. Simple! Ready to start?', category: 'Welcome', subcategory: 'First Order', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-4', name: 'Trade Customer Welcome', content: '🏢 Welcome to {{company}}, {{name}}! As a trade customer, you get wholesale pricing on all products. {{discount}}% off standard rates on orders over {{amount}}. Let us know how we can support your business!', category: 'Welcome', subcategory: 'Trade', variables: ['name', 'company', 'discount', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-welcome-5', name: 'Referred Customer Welcome', content: '🤝 {{name}}! {{referrer}} thought you\'d love our printing services. Welcome to {{company}} — enjoy {{discount}}% off your first order as a referral gift. Browse our products or reply to get started!', category: 'Welcome', subcategory: 'Referral', variables: ['name', 'referrer', 'company', 'discount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== SUPPORT ====================
  { id: 'tpl-support-1', name: 'Support Ticket Received', content: '📩 Thanks {{name}}! We\'ve received your support request regarding {{issue}}. Our print team will review and get back to you within {{hours}} hours. Your ticket #{{ticketId}} is logged.', category: 'Support', subcategory: 'Received', variables: ['name', 'issue', 'hours', 'ticketId'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-2', name: 'File Format Help', content: '📁 File format guide for {{name}}: We accept PDF (preferred), AI, PSD, and CDR. Requirements: 300 DPI, CMYK, 3mm bleed, fonts outlined. Need help converting? Reply with your file format and we\'ll assist!', category: 'Support', subcategory: 'File Help', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-3', name: 'Issue Resolved', content: '✅ Issue resolved, {{name}}! Your {{issue}} has been sorted. {{resolution}}. Please confirm everything looks good on your end. Always here if you need further assistance!', category: 'Support', subcategory: 'Resolution', variables: ['name', 'issue', 'resolution'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-4', name: 'Color Matching Help', content: '🎨 Color matching help, {{name}}! We can match Pantone PMS colors on any print job. Send us your PMS codes (e.g., PMS 186 C). We also offer G7-calibrated CMYK for consistent results across all orders.', category: 'Support', subcategory: 'Color', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-5', name: 'Shipping Support', content: '🚚 {{name}}, need help tracking your print order? Reply with your order #{{orderId}} and we\'ll check the carrier status. We ship via {{carriers}} and provide tracking for all orders over {{amount}}.', category: 'Support', subcategory: 'Shipping', variables: ['name', 'orderId', 'carriers', 'amount'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-support-6', name: 'General Inquiry Response', content: 'Thanks for reaching out, {{name}}! Got your question about {{topic}}. Here\'s the info: {{answer}}. Anything else we can help with? Our print specialists are available Mon-Fri {{hours}}.', category: 'Support', subcategory: 'General', variables: ['name', 'topic', 'answer', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== PRODUCT SPECIFIC ====================
  { id: 'tpl-product-1', name: 'Business Card Options', content: '💳 Business card options for {{name}}: Premium 14pt (gloss/matte/UV), eco-friendly recycled stock, premium cotton paper, or plastic cards. Standard size 85x55mm. {{quantity}} starting at {{price}}. Reply for samples!', category: 'Products', subcategory: 'Business Cards', variables: ['name', 'quantity', 'price'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-2', name: 'Flyer Size Guide', content: '📐 Flyer sizes for {{name}}: DL (99x210mm), A5 (148x210mm), A4 (210x297mm), A3 (297x420mm). We recommend 170-300gsm gloss or matte art paper. {{quantity}} flyers from {{price}}. Reply for recommendations!', category: 'Products', subcategory: 'Flyers', variables: ['name', 'quantity', 'price'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-3', name: 'Banner Material Options', content: '🏴 Banner materials for {{name}}: 440gsm vinyl (standard), mesh banner (wind-resistant), fabric banner (indoor), or PVC banner (long-term outdoor). Sizes up to {{maxSize}}. Grommets, pole pockets, or hemmed edges included.', category: 'Products', subcategory: 'Banners', variables: ['name', 'maxSize'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-4', name: 'Booklet/Brochure Binding', content: '📘 Binding options for {{name}}: Saddle-stitched (up to 64 pages), spiral/coil bound (lays flat), perfect bound (book-style), or wire-o (professional). {{quantity}} booklets starting at {{price}}. Reply for a binding sample set!', category: 'Products', subcategory: 'Booklets', variables: ['name', 'quantity', 'price'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-5', name: 'Sticker & Label Options', content: '🏷️ Sticker options for {{name}}: White vinyl (waterproof), clear/transparent, holographic, kraft paper, or fluorescent. Kiss-cut sheets, die-cut singles, or roll labels. Indoor or outdoor grade. Small runs welcome!', category: 'Products', subcategory: 'Stickers', variables: ['name'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-6', name: 'Wide Format Sizes', content: '📏 Wide format printing at {{company}}, {{name}}: Sizes up to {{maxWidth}} wide by any length. Perfect for billboards, wall murals, trade show displays, window graphics, and vehicle wraps. Indoor and outdoor materials available.', category: 'Products', subcategory: 'Wide Format', variables: ['name', 'company', 'maxWidth'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-7', name: 'Custom Packaging Options', content: '📦 Custom packaging at {{company}}, {{name}}: Folding cartons, rigid boxes, corrugated mailers, tissue paper, and branded tape. Short runs ({{minQty}}+) to bulk. Full-color offset or digital. Let\'s design your unboxing experience!', category: 'Products', subcategory: 'Packaging', variables: ['name', 'company', 'minQty'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-8', name: 'Finishing Options Guide', content: '✨ Available finishes at {{company}}: Gloss UV, soft-touch laminate, spot UV, foil stamping (gold/silver/metallic), embossing/debossing, die-cutting, scoring, folding, drilling, and perforation. Reply to discuss which finish suits your project!', category: 'Products', subcategory: 'Finishing', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-9', name: 'Paper Stock Options', content: '📄 Paper stocks at {{company}}, {{name}}: Gloss/matte art paper (100-400gsm), uncoated bond, textured laid, recycled craft, premium cotton, synthetic/waterproof, adhesive vinyl, magnetic sheets, and canvas. Request a paper swatch book!', category: 'Products', subcategory: 'Paper', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-product-10', name: 'Promotional Products', content: '🎁 Promotional products at {{company}}, {{name}}: Printed mugs, pens, T-shirts, tote bags, USB drives, keychains, notebooks, and more. Perfect for corporate gifts, events, and brand awareness. {{minQty}} minimum. Quote in {{hours}} hours!', category: 'Products', subcategory: 'Promotional', variables: ['name', 'company', 'minQty', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },

  // ==================== CTA ====================
  { id: 'tpl-cta-1', name: 'Request a Quote', content: '📋 Ready to get started, {{name}}? Reply with what you need printed — product, quantity, size, and finishing. We\'ll send a quote within {{hours}} hours from {{company}}!', category: 'CTA', subcategory: 'Quote', variables: ['name', 'hours', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-2', name: 'Call Our Print Team', content: '📞 Need to talk printing, {{name}}? Our team is available at {{phone}}, Mon-Fri {{hours}}. Or reply here with your question and we\'ll get back to you within {{responseTime}}!', category: 'CTA', subcategory: 'Call', variables: ['name', 'phone', 'hours', 'responseTime'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-3', name: 'Visit Our Showroom', content: '📍 Visit {{company}} at {{address}}! See paper samples, finish swatches, and previous work in person. Open {{hours}}. Bring your artwork on USB or send it ahead and we\'ll have it ready for review!', category: 'CTA', subcategory: 'Visit', variables: ['name', 'company', 'address', 'hours'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-4', name: 'Request Samples', content: '🎯 Want to feel our print quality, {{name}}? Reply with your address and we\'ll send a sample pack including various paper stocks, finishes, and products from {{company}}. Free of charge!', category: 'CTA', subcategory: 'Samples', variables: ['name', 'company'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-5', name: 'Upload Your Artwork', content: '💻 Ready to print, {{name}}? Upload your print-ready files at {{uploadLink}}. Accepted formats: PDF, AI, PSD, CDR. Need a template? Reply with your product and we\'ll send the right template!', category: 'CTA', subcategory: 'Upload', variables: ['name', 'uploadLink'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
  { id: 'tpl-cta-6', name: 'Limited Time Print Deal', content: '⏰ Last chance, {{name}}! Our {{product}} special at {{company}} ends {{date}}. {{quantity}} for {{price}} — premium quality, fast turnaround. Reply ORDER to secure this price before it\'s gone!', category: 'CTA', subcategory: 'Limited Time', variables: ['name', 'product', 'company', 'date', 'quantity', 'price'], status: 'active', usageCount: 0, createdAt: '', isPreloaded: true },
];

// Generate additional printing-specific templates programmatically
const ADDITIONAL_TEMPLATES: WhatsAppTemplate[] = [];

const printProducts = ['Business Cards', 'Flyers', 'Brochures', 'Banners', 'Stickers', 'Labels', 'Booklets', 'Catalogs', 'Posters', 'Packaging Boxes', 'Letterheads', 'Envelopes', 'Calendars', 'Greeting Cards', 'Invitations', 'Menus', 'Folders', 'Notepads', 'T-Shirts', 'Mugs', 'Signs', 'Billboards', 'Canvas Prints', 'Photo Books', 'Hang Tags', 'Wristbands', 'Table Tents', 'Door Hangers', 'Placemats', 'Coasters', 'Magnets', 'Stamps', 'Certificates', 'Tickets', 'Coupons'];
const printActions = ['Quote', 'Order', 'Proof', 'Design', 'Print', 'Reorder', 'Ship', 'Deliver', 'Inquire', 'Sample'];
const printFinishes = ['Glossy UV', 'Soft Touch', 'Spot UV', 'Foil Stamped', 'Embossed', 'Debossed', 'Matte Laminated', 'Gloss Laminated', 'Die Cut', 'Scored & Folded', 'Spiral Bound', 'Perfect Bound', 'Saddle Stitched', 'Wire-O', 'Grommetted', 'Hemmed'];
const printPapers = ['100lb Gloss', '100lb Matte', '14pt Cardstock', '80lb Cover', '70lb Text', 'Premium Cotton', 'Recycled Kraft', 'Clear Vinyl', 'White Vinyl', 'Canvas', 'Magnetic Sheet'];

let templateIdx = 100;
for (let i = 0; i < 500; i++) {
  const product = printProducts[i % printProducts.length];
  const action = printActions[i % printActions.length];
  const finish = printFinishes[i % printFinishes.length];
  const paper = printPapers[i % printPapers.length];
  const subcat = action;
  const id = `tpl-pgen-${templateIdx++}`;

  ADDITIONAL_TEMPLATES.push({
    id,
    name: `${action} - ${product}`,
    content: `Hi {{name}}! Regarding your ${product.toLowerCase()} ${action.toLowerCase()} at {{company}}: We recommend ${paper} with ${finish} finish for the best results. {{quantity ? 'For ' + quantity + ' units, we can offer a competitive rate.' : 'Small to large runs available.'}} Reply to proceed or ask questions! 📨`,
    category: 'Print Services',
    subcategory: subcat,
    variables: ['name', 'company', 'quantity'],
    status: 'active',
    usageCount: 0,
    createdAt: '',
    isPreloaded: true
  });
}

const ALL_TEMPLATES = [...MARKETING_TEMPLATES, ...ADDITIONAL_TEMPLATES];

class WhatsAppMarketingService {
  private _initialized = false;
  private _initializing = false;

  async ensureInitialized(): Promise<void> {
    if (this._initialized) return;
    if (this._initializing) {
      // Wait for the in-progress initialization to complete
      while (this._initializing) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }
    this._initializing = true;
    try {
      await this.initializeTemplates();
      this._initialized = true;
    } finally {
      this._initializing = false;
    }
  }

  async initializeTemplates(): Promise<void> {
    const existing = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    const now = new Date().toISOString();
    const missing: WhatsAppTemplate[] = [];
    
    // Only insert templates that truly don't exist yet
    for (const template of ALL_TEMPLATES) {
      const exists = existing.find(t => t.id === template.id);
      if (!exists) {
        missing.push({ 
          ...template, 
          createdAt: now,
          usageCount: 0
        });
      }
    }

    if (missing.length === 0) return;

    // Batch insert to avoid N+1 requests
    const batchSize = 50;
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      await Promise.all(
        batch.map(t => dbService.put('whatsappTemplates', t))
      );
    }
  }

  async getTemplates(category?: string): Promise<WhatsAppTemplate[]> {
    const templates = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    if (category) {
      return templates.filter(t => t.category === category);
    }
    return templates;
  }

  async getTemplateById(id: string): Promise<WhatsAppTemplate | undefined> {
    const templates = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    return templates.find(t => t.id === id);
  }

  async saveTemplate(template: Partial<WhatsAppTemplate>): Promise<string> {
    const newTemplate: WhatsAppTemplate = {
      id: template.id || `tpl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: template.name || 'Untitled Template',
      content: template.content || '',
      category: template.category || 'General',
      subcategory: template.subcategory || 'Custom',
      variables: template.variables || [],
      status: template.status || 'draft',
      usageCount: 0,
      createdAt: new Date().toISOString(),
      isPreloaded: false
    };
    await dbService.put('whatsappTemplates', newTemplate);
    return newTemplate.id;
  }

  async deleteTemplate(id: string): Promise<void> {
    await dbService.delete('whatsappTemplates', id);
  }

  async getChats(): Promise<WhatsAppChat[]> {
    return dbService.getAll<WhatsAppChat>('whatsappChats');
  }

  async getChatById(id: string): Promise<WhatsAppChat | undefined> {
    const chats = await dbService.getAll<WhatsAppChat>('whatsappChats');
    return chats.find(c => c.id === id);
  }

  async createChat(chat: Partial<WhatsAppChat>): Promise<string> {
    const newChat: WhatsAppChat = {
      id: chat.id || `chat-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      customerId: chat.customerId || '',
      customerName: chat.customerName || '',
      customerPhone: chat.customerPhone || '',
      lastMessage: chat.lastMessage || '',
      lastMessageAt: new Date().toISOString(),
      status: chat.status || 'unread',
      priority: chat.priority || 'normal',
      tags: chat.tags || [],
      messages: [],
      unreadCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbService.put('whatsappChats', newChat);
    return newChat.id;
  }

  async sendMessage(chatId: string, content: string, type: WhatsAppMessage['type'] = 'text'): Promise<string> {
    const chat = await this.getChatById(chatId);
    if (!chat) throw new Error('Chat not found');

    const message: WhatsAppMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      chatId,
      content,
      type,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date().toISOString()
    };

    const updatedChat: WhatsAppChat = {
      ...chat,
      lastMessage: content,
      lastMessageAt: message.timestamp,
      status: chat.unreadCount > 0 ? 'unread' : 'read',
      messages: [...chat.messages, message],
      updatedAt: new Date().toISOString()
    };

    await dbService.put('whatsappChats', updatedChat);
    return message.id;
  }

  async receiveMessage(chatId: string, content: string, type: WhatsAppMessage['type'] = 'text'): Promise<string> {
    const chat = await this.getChatById(chatId);
    if (!chat) throw new Error('Chat not found');

    const message: WhatsAppMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      chatId,
      content,
      type,
      direction: 'inbound',
      status: 'delivered',
      timestamp: new Date().toISOString()
    };

    const updatedChat: WhatsAppChat = {
      ...chat,
      lastMessage: content,
      lastMessageAt: message.timestamp,
      status: 'unread',
      unreadCount: chat.unreadCount + 1,
      messages: [...chat.messages, message],
      updatedAt: new Date().toISOString()
    };

    await dbService.put('whatsappChats', updatedChat);
    return message.id;
  }

  async markAsRead(chatId: string): Promise<void> {
    const chats = await dbService.getAll<WhatsAppChat>('whatsappChats');
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      const updatedChat: WhatsAppChat = {
        ...chat,
        status: 'read',
        unreadCount: 0,
        updatedAt: new Date().toISOString()
      };
      await dbService.put('whatsappChats', updatedChat);
    }
  }

  async getCampaigns(): Promise<WhatsAppCampaign[]> {
    return dbService.getAll<WhatsAppCampaign>('whatsappCampaigns');
  }

  async createCampaign(campaign: Partial<WhatsAppCampaign>): Promise<string> {
    const newCampaign: WhatsAppCampaign = {
      id: campaign.id || `camp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: campaign.name || 'Untitled Campaign',
      description: campaign.description || '',
      templateId: campaign.templateId,
      message: campaign.message || '',
      recipients: campaign.recipients || [],
      recipientCount: campaign.recipients?.length || 0,
      status: 'draft',
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      cost: 0,
      createdAt: new Date().toISOString(),
      createdBy: campaign.createdBy || 'system'
    };
    await dbService.put('whatsappCampaigns', newCampaign);
    return newCampaign.id;
  }

  async sendCampaign(campaignId: string): Promise<void> {
    const campaigns = await dbService.getAll<WhatsAppCampaign>('whatsappCampaigns');
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign) throw new Error('Campaign not found');

    const updated = {
      ...campaign,
      status: 'sent' as const,
      sentAt: new Date().toISOString(),
      sentCount: campaign.recipients.length,
      deliveredCount: Math.floor(campaign.recipients.length * 0.85),
      readCount: Math.floor(campaign.recipients.length * 0.6),
      failedCount: Math.floor(campaign.recipients.length * 0.05)
    };
    await dbService.put('whatsappCampaigns', updated);
  }

  async getAutomations(): Promise<AutomationFlow[]> {
    return dbService.getAll<AutomationFlow>('whatsappAutomations');
  }

  async createAutomation(flow: Partial<AutomationFlow>): Promise<string> {
    const newFlow: AutomationFlow = {
      id: flow.id || `flow-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      name: flow.name || 'Untitled Flow',
      description: flow.description || '',
      trigger: flow.trigger || 'hello',
      triggerType: flow.triggerType || 'keyword',
      steps: flow.steps || [],
      status: 'draft',
      stats: { triggered: 0, completed: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbService.put('whatsappAutomations', newFlow);
    return newFlow.id;
  }

  async toggleAutomation(flowId: string): Promise<void> {
    const flows = await dbService.getAll<AutomationFlow>('whatsappAutomations');
    const flow = flows.find(f => f.id === flowId);
    if (flow) {
      const updated: AutomationFlow = {
        ...flow,
        status: flow.status === 'active' ? 'paused' : 'active',
        updatedAt: new Date().toISOString()
      };
      await dbService.put('whatsappAutomations', updated);
    }
  }

  async incrementTemplateUsage(templateId: string): Promise<void> {
    const templates = await dbService.getAll<WhatsAppTemplate>('whatsappTemplates');
    const template = templates.find(t => t.id === templateId);
    if (template) {
      const updated = { ...template, usageCount: template.usageCount + 1 };
      await dbService.put('whatsappTemplates', updated);
    }
  }

  getTemplateCategories(): string[] {
    const cats = new Set(ALL_TEMPLATES.map(t => t.category));
    return Array.from(cats);
  }

  getTemplateSubcategories(category?: string): string[] {
    const filtered = category 
      ? ALL_TEMPLATES.filter(t => t.category === category)
      : ALL_TEMPLATES;
    const subs = new Set(filtered.map(t => t.subcategory));
    return Array.from(subs);
  }

  interpolateTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }
}

export const whatsAppMarketingService = new WhatsAppMarketingService();