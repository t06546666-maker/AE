const crypto = require('crypto');
const { uploadFileToCloudStorage, deleteFileFromCloudStorage } = require('./cloud-storage.cjs');

const SETTINGS_KEY = 'customer_home_content';

function cleanContent(input) {
  const value = input && typeof input === 'object' ? input : {};
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    ...(Array.isArray(value.carouselIds)?{carouselIds:[...new Set(value.carouselIds.filter(id=>typeof id==='string'&&id.length<100))].slice(0,40)}:{}),
    carouselHeight: Math.min(640,Math.max(220,Number(value.carouselHeight)||420)),
    sections: Array.isArray(value.sections) ? [...new Map(value.sections.filter(item=>item&&['best','trending','image','nearby','categories','favourites'].includes(item.id)).map(item=>[item.id,{
      id:item.id,visible:item.visible!==false,
      offerIds:Array.isArray(item.offerIds)?[...new Set(item.offerIds.filter(id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))].slice(0,item.id==='best'?5:40):[],
      images:Array.isArray(item.images)?item.images.filter(image=>image&&/^https:\/\//.test(String(image.url||''))).slice(0,20).map(image=>({id:String(image.id||crypto.randomUUID()).slice(0,100),url:String(image.url).slice(0,1000),alt:String(image.alt||'').slice(0,180)})):[],
    }])).values()] : [],
    banners: Array.isArray(value.banners) ? value.banners.slice(0, 40).map((item) => ({
      id: String(item.id || crypto.randomUUID()),
      title: String(item.title || '').slice(0, 180),
      subtitle: String(item.subtitle || '').slice(0, 300),
      titleMl: String(item.titleMl || '').slice(0, 180),
      subtitleMl: String(item.subtitleMl || '').slice(0, 300),
      imageUrl: String(item.imageUrl || '').slice(0, 1000),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
      active: item.active !== false,
      link: String(item.link || '').slice(0, 500),
    })) : [],
    pageText: value.pageText && typeof value.pageText === 'object' ? value.pageText : {},
  };
}

function registerCustomerHomeContent(app, { auth, adminRole, supabase, uploadMiddleware }) {
  async function readContent() {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', SETTINGS_KEY).maybeSingle();
    if (error) throw error;
    if (!data?.value) return cleanContent({});
    try { return cleanContent(JSON.parse(data.value)); } catch { return cleanContent({}); }
  }

  app.get('/api/customer/home-content', async (_req, res) => {
    try {
      const content = await readContent();
      res.json({ success: true, content });
    } catch (error) {
      console.error('Customer home content read failed:', error);
      res.status(500).json({ success: false, error: 'Unable to load customer home content' });
    }
  });

  app.get('/api/admin/customer-home-content', auth, adminRole, async (_req, res) => {
    try { res.json({ success: true, content: await readContent() }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });

  app.put('/api/admin/customer-home-content', auth, adminRole, async (req, res) => {
    try {
      const content = cleanContent(req.body);
      const { error } = await supabase.from('app_settings').upsert({ key: SETTINGS_KEY, value: JSON.stringify(content) });
      if (error) return res.status(400).json({ success: false, error: error.message });
      res.json({ success: true, content });
    } catch (error) { res.status(400).json({ success: false, error: error.message }); }
  });

  app.post('/api/admin/customer-home-content/assets', auth, adminRole, uploadMiddleware, async (req, res) => {
    try {
      if (!req.file?.buffer) return res.status(400).json({ success: false, error: 'Image file is required' });
      if (!String(req.file.mimetype || '').startsWith('image/')) return res.status(400).json({ success: false, error: 'Only image files are allowed' });
      if (req.file.size > 8 * 1024 * 1024) return res.status(413).json({ success: false, error: 'Image must be 8 MB or smaller' });
      const ext = (req.file.originalname || '').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `customer-home/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const url = await uploadFileToCloudStorage(path, req.file.buffer, req.file.mimetype);
      res.json({ success: true, url, storagePath: path });
    } catch (error) { console.error('Customer home asset upload failed:', error); res.status(500).json({ success: false, error: error.message }); }
  });

  app.delete('/api/admin/customer-home-content/assets', auth, adminRole, async (req, res) => {
    try { await deleteFileFromCloudStorage(req.body?.url || req.body?.storagePath || ''); res.json({ success: true }); }
    catch (error) { res.status(500).json({ success: false, error: error.message }); }
  });
}

async function homeFeaturedOfferIds(supabase){
 const {data,error}=await supabase.from('app_settings').select('value').eq('key',SETTINGS_KEY).maybeSingle();
 if(error)throw error;
 let value={};try{value=JSON.parse(data?.value||'{}');}catch{}
 return [...new Set(cleanContent(value).sections.filter(row=>row.visible&&['best','trending'].includes(row.id)).flatMap(row=>row.offerIds))];
}
module.exports = { registerCustomerHomeContent, SETTINGS_KEY, cleanContent, homeFeaturedOfferIds };
