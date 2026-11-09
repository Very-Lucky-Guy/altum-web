import test from 'node:test';
import assert from 'node:assert/strict';
import { origoCheckout, origoCatalog, templates, sizes } from '../lib/origo.js';
const map = Object.fromEntries(Object.entries(templates).map(([k,template],i)=>[k,{
  template,color:'Black',variants:Object.fromEntries(sizes.map((s,j)=>[s,String(1000000+i*10+j)]))
}]));
const env = (m=map)=>({ORIGO_SHOPIFY_LIVE:'true', ORIGO_SHOPIFY_MAP:JSON.stringify(m)});
test('every black edition and size opens exactly its selected Shopify variant',()=>{
  for(const edition of Object.keys(templates)) for(const size of sizes) {
    const url=new URL(origoCheckout({edition,size,language:'es'},env()).url);
    assert.equal(url.pathname,'/cart/'+map[edition].variants[size]+':1');
    assert.equal(url.hostname,'aikiij-wf.myshopify.com');
  }
  assert.throws(()=>origoCheckout({edition:'cobalt',size:'3XL'},env()));
});
test('closed until all 18 unique variants are linked to matching templates',()=>{
  for(const mutate of [m=>{delete m.original.variants.XS},m=>{m.cobalt.template=m.original.template},m=>{m.fuchsia.variants.L=m.cobalt.variants.M},m=>{m.cobalt.color='White'}]){
    const m=structuredClone(map); mutate(m);
    assert.equal(origoCatalog(env(m)).available,false);
    assert.throws(()=>origoCheckout({edition:'original',size:'M'},env(m)),{status:503});
  }
  assert.equal(origoCatalog({}).available,false);
});

test('WooCommerce links use the selected variation and never open the Shopify checkout on invalid Woo configuration', () => {
  const wooEnv = { ...env(), ORIGO_WOO_LIVE: 'true', ORIGO_WOO_ORIGIN: 'https://checkout.example', ORIGO_WOO_MAP: JSON.stringify(map) };
  for (const edition of Object.keys(templates)) for (const size of sizes) {
    const url = new URL(origoCheckout({edition, size}, wooEnv).url);
    assert.equal(url.host, origoCatalog(wooEnv).checkoutHost);
    assert.equal(url.pathname, '/checkout-link/');
    assert.equal(url.searchParams.get('products'), map[edition].variants[size] + ':1');
  }
  assert.equal(origoCatalog({...wooEnv, ORIGO_WOO_ORIGIN:'http://checkout.example'}).available, false);
  assert.throws(() => origoCheckout({edition:'cobalt', size:'2XL'}, {...wooEnv, ORIGO_WOO_MAP:'{}'}), {status:503});
});
