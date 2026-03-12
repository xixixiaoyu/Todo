import{_ as s,P as U,O as q,Q,R as V,a9 as X,a8 as Z,W as w,T as j,ak as H,ao as J,aq as K,ar as W,as as Y,X as ee,ae as te,at as ae,am as re}from"./markdown-vendor-DwkRGqvJ.js";import{p as ie}from"./chunk-4BX2VUAB-Pc1zzIB2.js";import{p as se}from"./treemap-KMMF4GRG-ByteJBHN.js";import"./utils-vendor-BLyG6cs3.js";import"./vue-vendor-BhjQ3G46.js";var le=re.pie,D={sections:new Map,showData:!1},g=D.sections,C=D.showData,oe=structuredClone(le),ne=s(()=>structuredClone(oe),"getConfig"),ce=s(()=>{g=new Map,C=D.showData,te()},"clear"),de=s(({label:e,value:a})=>{if(a<0)throw new Error(`"${e}" has invalid value: ${a}. Negative values are not allowed in pie charts. All slice values must be >= 0.`);g.has(e)||(g.set(e,a),w.debug(`added new section: ${e}, with value: ${a}`))},"addSection"),pe=s(()=>g,"getSections"),ge=s(e=>{C=e},"setShowData"),ue=s(()=>C,"getShowData"),G={getConfig:ne,clear:ce,setDiagramTitle:Z,getDiagramTitle:X,setAccTitle:V,getAccTitle:Q,setAccDescription:q,getAccDescription:U,addSection:de,getSections:pe,setShowData:ge,getShowData:ue},fe=s((e,a)=>{ie(e,a),a.setShowData(e.showData),e.sections.map(a.addSection)},"populateDb"),he={parse:s(async e=>{const a=await se("pie",e);w.debug(a),fe(a,G)},"parse")},me=s(e=>`
  .pieCircle{
    stroke: ${e.pieStrokeColor};
    stroke-width : ${e.pieStrokeWidth};
    opacity : ${e.pieOpacity};
  }
  .pieOuterCircle{
    stroke: ${e.pieOuterStrokeColor};
    stroke-width: ${e.pieOuterStrokeWidth};
    fill: none;
  }
  .pieTitleText {
    text-anchor: middle;
    font-size: ${e.pieTitleTextSize};
    fill: ${e.pieTitleTextColor};
    font-family: ${e.fontFamily};
  }
  .slice {
    font-family: ${e.fontFamily};
    fill: ${e.pieSectionTextColor};
    font-size:${e.pieSectionTextSize};
    // fill: white;
  }
  .legend text {
    fill: ${e.pieLegendTextColor};
    font-family: ${e.fontFamily};
    font-size: ${e.pieLegendTextSize};
  }
`,"getStyles"),ve=me,Se=s(e=>{const a=[...e.values()].reduce((r,l)=>r+l,0),$=[...e.entries()].map(([r,l])=>({label:r,value:l})).filter(r=>r.value/a*100>=1).sort((r,l)=>l.value-r.value);return ae().value(r=>r.value)($)},"createPieArcs"),xe=s((e,a,$,y)=>{w.debug(`rendering pie chart
`+e);const r=y.db,l=j(),T=H(r.getConfig(),l.pie),A=40,o=18,d=4,c=450,u=c,f=J(a),n=f.append("g");n.attr("transform","translate("+u/2+","+c/2+")");const{themeVariables:i}=l;let[_]=K(i.pieOuterStrokeWidth);_??=2;const b=T.textPosition,p=Math.min(u,c)/2-A,O=W().innerRadius(0).outerRadius(p),P=W().innerRadius(p*b).outerRadius(p*b);n.append("circle").attr("cx",0).attr("cy",0).attr("r",p+_/2).attr("class","pieOuterCircle");const h=r.getSections(),R=Se(h),M=[i.pie1,i.pie2,i.pie3,i.pie4,i.pie5,i.pie6,i.pie7,i.pie8,i.pie9,i.pie10,i.pie11,i.pie12];let m=0;h.forEach(t=>{m+=t});const E=R.filter(t=>(t.data.value/m*100).toFixed(0)!=="0"),v=Y(M);n.selectAll("mySlices").data(E).enter().append("path").attr("d",O).attr("fill",t=>v(t.data.label)).attr("class","pieCircle"),n.selectAll("mySlices").data(E).enter().append("text").text(t=>(t.data.value/m*100).toFixed(0)+"%").attr("transform",t=>"translate("+P.centroid(t)+")").style("text-anchor","middle").attr("class","slice"),n.append("text").text(r.getDiagramTitle()).attr("x",0).attr("y",-400/2).attr("class","pieTitleText");const k=[...h.entries()].map(([t,x])=>({label:t,value:x})),S=n.selectAll(".legend").data(k).enter().append("g").attr("class","legend").attr("transform",(t,x)=>{const F=o+d,L=F*k.length/2,N=12*o,B=x*F-L;return"translate("+N+","+B+")"});S.append("rect").attr("width",o).attr("height",o).style("fill",t=>v(t.label)).style("stroke",t=>v(t.label)),S.append("text").attr("x",o+d).attr("y",o-d).text(t=>r.getShowData()?`${t.label} [${t.value}]`:t.label);const I=Math.max(...S.selectAll("text").nodes().map(t=>t?.getBoundingClientRect().width??0)),z=u+A+o+d+I;f.attr("viewBox",`0 0 ${z} ${c}`),ee(f,c,z,T.useMaxWidth)},"draw"),we={draw:xe},Ae={parser:he,db:G,renderer:we,styles:ve};export{Ae as diagram};
