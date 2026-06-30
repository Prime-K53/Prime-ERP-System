import React, { useState } from 'react';
import { 
  MessageSquare, Send, X, Users, MessageCircle, 
  Sparkles, Check, ChevronRight, Copy, Wand2, Loader2
} from 'lucide-react';
import { getPlaceholder } from '../constants/placeholders';
import { aiService } from '../services/aiService';

const AI_TEMPLATES = [
  {
    id: 'business_cards',
    name: 'Business Card Quote',
    description: 'Follow up on a business card printing inquiry',
    content: "Hi [Customer Name]! Thanks for your business card inquiry at [Company Name]. We offer premium 14pt card stock with glossy, matte, or spot UV finish. Reply with quantity and we'll send a quote within hours!"
  },
  {
    id: 'quote_sent',
    name: 'Print Quote Sent',
    description: 'Notify customer their print quote is ready',
    content: "Hi [Customer Name]! Your print quote #[Quote Number] from [Company Name] is ready. [Product] — [Quantity] units — [Amount]. Quote includes design, printing, finishing, and delivery. Reply to accept or ask questions!"
  },
  {
    id: 'order_confirmed',
    name: 'Print Order Confirmed',
    description: 'Confirm a new print order',
    content: "Great news [Customer Name]! Your print order #[Order Number] for [Product] has been confirmed at [Company Name]. Files are being pre-flighted. We'll update you once production begins!"
  },
  {
    id: 'proof_ready',
    name: 'Design Proof Ready',
    description: 'Notify customer their print proof is available',
    content: "Hi [Customer Name]! Your design proof for [Product] at [Company Name] is ready for review. View it here: [Proof Link]. Please approve or request changes. We'll print once approved!"
  },
  {
    id: 'in_production',
    name: 'Order In Production',
    description: 'Let customer know their order is being printed',
    content: "Hi [Customer Name]! Your order #[Order Number] at [Company Name] is now on press. [Product] — [Quantity] copies — [Finishing]. Estimated completion: [Date]. We'll notify you when it's ready!"
  },
  {
    id: 'ready_pickup',
    name: 'Ready for Pickup',
    description: 'Notify customer their prints are ready to collect',
    content: "Hi [Customer Name]! Your order #[Order Number] at [Company Name] is printed, finished, and ready for pickup. We're open [Hours]. Please bring your order confirmation. See you soon!"
  },
  {
    id: 'order_shipped',
    name: 'Order Shipped',
    description: 'Notify customer their prints have been shipped',
    content: "Hi [Customer Name]! Your print order #[Order Number] from [Company Name] is on its way! Carrier: [Carrier]. Tracking: [Tracking Link]. Estimated delivery: [Date]. Thank you for your business!"
  },
  {
    id: 'flyer_promo',
    name: 'Flyer Printing Promo',
    description: 'Promote flyer printing services',
    content: "Hi [Customer Name]! Looking for flyer printing? [Company Name] is running a special: [Quantity] full-color flyers on 100lb gloss for just [Price]! Design service available. Offer ends [Date]. Reply to order!"
  },
  {
    id: 'banner_sale',
    name: 'Banner Printing Sale',
    description: 'Promote banner and signage printing',
    content: "Hi [Customer Name]! Need banners? [Company Name] offers weather-resistant vinyl banners starting at [Price] for [Size]. Full-color, hemmed, with grommets. Perfect for events, grand openings, and promotions!"
  },
  {
    id: 'reorder_reminder',
    name: 'Reorder Reminder',
    description: 'Remind customer to reorder print materials',
    content: "Hi [Customer Name]! It's been a while since your last print order at [Company Name]. We still have your [Product] files on file — ready to reprint anytime. Reply to order more or request a revised quote!"
  },
  {
    id: 'file_format_help',
    name: 'File Format Help',
    description: 'Assist customer with artwork file submission',
    content: "Hi [Customer Name]! Need help with your print files? We accept PDF, AI, PSD, and CDR with 3mm bleed. Reply with your file format and we'll guide you. We also offer design services if needed!"
  },
  {
    id: 'design_consult',
    name: 'Design Consultation',
    description: 'Offer graphic design services for print',
    content: "Hi [Customer Name]! Need a design for your print project? Our in-house designers at [Company Name] can create professional layouts, logos, and artwork. Starting at [Price]. Reply with your requirements!"
  },
  {
    id: 'bulk_discount',
    name: 'Bulk Print Discount',
    description: 'Offer volume pricing for large print runs',
    content: "Hi [Customer Name]! Printing in bulk? [Company Name] offers tiered pricing — the more you print, the more you save. Get up to [Discount]% off on orders over [Quantity] units. Request a bulk quote today!"
  },
  {
    id: 'invoice_reminder',
    name: 'Print Invoice Reminder',
    description: 'Polite reminder about outstanding print invoice',
    content: "Hi [Customer Name]! Gentle reminder about invoice #[Invoice Number] from [Company Name] for [Amount], due on [Due Date]. You can pay via bank transfer, card, or PayPal. Reply if you need the payment link!"
  },
  {
    id: 'welcome_print',
    name: 'Welcome to Our Print Shop',
    description: 'Welcome new printing customers',
    content: "Hi [Customer Name]! Welcome to [Company Name]! We offer business cards, flyers, brochures, banners, stickers, and more. Upload your artwork or describe your project and we'll get started. We're excited to work with you!"
  },
  {
    id: 'sticker_promo',
    name: 'Sticker & Label Printing',
    description: 'Promote sticker and label printing services',
    content: "Hi [Customer Name]! Custom stickers and labels at [Company Name] — kiss cut, die cut, waterproof vinyl, matte or gloss. Small runs welcome. Perfect for branding, packaging, and promotions. Request a quote!"
  },
  {
    id: 'proof_approved',
    name: 'Proof Approved — Going to Print',
    description: 'Confirm approval and start production',
    content: "Thanks [Customer Name]! Your design proof for [Product] is approved. We'll begin printing shortly. Estimated completion: [Date]. We'll send a photo of the finished product before shipping!"
  },
  {
    id: 'satisfaction_check',
    name: 'Print Quality Follow-up',
    description: 'Check if customer is happy with their prints',
    content: "Hi [Customer Name]! How are your prints from [Company Name] looking? We value your feedback. Reply with a photo or let us know if everything meets your expectations. We're here if you need adjustments!"
  },
  {
    id: 'catalog_brochure',
    name: 'Catalog & Brochure Printing',
    description: 'Promote booklet and brochure printing',
    content: "Hi [Customer Name]! Need catalogs or brochures? [Company Name] offers saddle-stitched, spiral-bound, and perfect-bound booklets. Full color, premium paper stocks. Design included. Request a sample pack!"
  },
  {
    id: 'seasonal_print',
    name: 'Seasonal Printing Special',
    description: 'Promote seasonal/holiday printing services',
    content: "Hi [Customer Name]! [Season] is here! [Company Name] is running specials on [Product] — perfect for [Occasion]. Order by [Date] to guarantee delivery. Reply to learn more or place your order!"
  },
  {
    id: 'large_format',
    name: 'Large Format Printing',
    description: 'Promote large format and signage',
    content: "Hi [Customer Name]! [Company Name] now offers large format printing — billboards, vehicle wraps, window graphics, trade show displays, and more. UV-resistant, weatherproof. Request a site survey and quote!"
  },
  {
    id: 'referral_print',
    name: 'Refer a Business',
    description: 'Ask for referrals to other businesses',
    content: "Hi [Customer Name]! Enjoying our print services? Refer another business to [Company Name] and you'll get [Reward] credit on your next order. Share your referral code: [Referral Code]. Thank you for your trust!"
  },
  {
    id: 'packaging_print',
    name: 'Custom Packaging Printing',
    description: 'Promote custom box and packaging printing',
    content: "Hi [Customer Name]! Elevate your brand with custom packaging from [Company Name]. We print boxes, bags, tissue paper, and labels. Short runs available. Make your unboxing experience unforgettable. Get a quote!"
  },
  {
    id: 'color_matching',
    name: 'PMS Color Matching',
    description: 'Offer Pantone color matching service',
    content: "Hi [Customer Name]! Need exact brand colors? [Company Name] offers Pantone PMS color matching on all print jobs. Provide your PMS codes and we'll match them precisely. Reply with your color requirements!"
  }
];

interface WhatsAppMarketingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
}

const WhatsAppMarketingModal: React.FC<WhatsAppMarketingModalProps> = ({ 
  open, 
  onOpenChange,
  companyName
}) => {
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [sendToGroup, setSendToGroup] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'templates' | 'message'>('templates');
  const [aiDescription, setAiDescription] = useState('');
  const [generating, setGenerating] = useState(false);

  const handleApplyTemplate = (template: typeof AI_TEMPLATES[0]) => {
    let content = template.content.replace(/\[Company Name\]/g, companyName || 'Prime ERP');
    setMessage(content);
    setSelectedTemplate(template.id);
    setActiveSection('message');
  };

  const handleGenerateWithAI = async () => {
    if (!aiDescription.trim()) return;
    setGenerating(true);
    try {
      const result = await aiService.generateTemplate(aiDescription);
      if (result) {
        setMessage(result.content.replace(/{{company}}/g, companyName || 'Prime ERP'));
        setSelectedTemplate('ai-generated');
        setActiveSection('message');
      } else {
        alert('AI generation failed. Please check your AI settings in Marketing Messages.');
      }
    } catch {
      alert('Failed to generate template. Ensure AI is configured.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;

    let url = '';
    if (sendToGroup) {
      url = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    } else {
      const cleanPhone = recipient.replace(/[^0-9]/g, '');
      if (!cleanPhone) {
        alert('Please enter a valid phone number for direct messaging.');
        return;
      }
      url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    onOpenChange(false);
  };

  const handleClose = () => {
    setRecipient('');
    setMessage('');
    setSendToGroup(false);
    setSelectedTemplate(null);
    setActiveSection('templates');
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                WhatsApp Marketing
              </h2>
              <p className="text-xs text-slate-500">
                Send marketing messages to customers
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={!message.trim() || (!sendToGroup && !recipient.trim())}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Launch WhatsApp
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex border-t border-slate-200">
          <div className="w-48 bg-slate-50 border-r border-slate-200 py-4">
            <button
              onClick={() => setActiveSection('templates')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                activeSection === 'templates'
                  ? 'bg-emerald-50 text-emerald-600 border-r-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Templates
            </button>
            <button
              onClick={() => setActiveSection('message')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                activeSection === 'message'
                  ? 'bg-emerald-50 text-emerald-600 border-r-2 border-emerald-600'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              Message
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              {activeSection === 'templates' && (
                <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                  {/* AI Generator */}
                  <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-3">
                      <Wand2 size={16} className="text-indigo-600" />
                      <span className="text-sm font-bold text-indigo-700">Generate with AI</span>
                    </div>
                    <textarea
                      value={aiDescription}
                      onChange={(e) => setAiDescription(e.target.value)}
                      placeholder="Describe the message you want...&#10;e.g. A friendly reminder for customers with overdue invoices"
                      className="w-full px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-20 mb-2"
                    />
                    <button
                      onClick={handleGenerateWithAI}
                      disabled={generating || !aiDescription.trim()}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                      {generating ? 'Generating...' : 'Generate Template'}
                    </button>
                  </div>

                  <h3 className="text-sm font-semibold text-slate-700 mb-4">AI-Generated Templates</h3>
                  {AI_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleApplyTemplate(template)}
                      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 group ${
                        selectedTemplate === template.id 
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className={`font-semibold ${selectedTemplate === template.id ? 'text-emerald-700' : 'text-slate-700'}`}>
                          {template.name}
                        </span>
                        {selectedTemplate === template.id && (
                          <Check size={16} className="text-emerald-600" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-600">
                        {template.description}
                      </p>
                    </button>
                  ))}
                  
                  <div className="mt-4 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                    <p className="text-[11px] text-indigo-600/70 uppercase font-bold tracking-widest flex items-center gap-2">
                      <Sparkles size={10} /> Pro Tip
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Use placeholders like [Customer Name] to personalize your messages before sending.
                    </p>
                  </div>
                </div>
              )}

              {activeSection === 'message' && (
                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-4 custom-scrollbar">
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      onClick={() => setSendToGroup(false)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        !sendToGroup ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <MessageCircle size={16} /> Direct
                    </button>
                    <button
                      onClick={() => setSendToGroup(true)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                        sendToGroup ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      <Users size={16} /> Group/Anyone
                    </button>
                  </div>

                  {!sendToGroup && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder={getPlaceholder.phone()}
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  )}

                  {sendToGroup && (
                    <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                      <p className="text-xs text-orange-700 font-medium">
                        Choosing "Group/Anyone" will open WhatsApp and let you select from your contacts or groups to send the message.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Message Content
                    </label>
                    <textarea
                      rows={8}
                      placeholder="e.g. Hi there! We have an exciting new collection..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none text-slate-700 leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppMarketingModal;