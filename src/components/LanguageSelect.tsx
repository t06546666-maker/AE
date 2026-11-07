import {useTranslation} from 'react-i18next';
import {uiText} from '../uiText';
export function LanguageSelect(){
 const {i18n}=useTranslation(undefined,{bindI18n:'languageChanged loaded'});
 return <label className="ae-language-select"><span>{uiText('Language')}</span><select aria-label={uiText('Language')} value={i18n.language.startsWith('ml')?'ml':'en'} onChange={e=>void i18n.changeLanguage(e.target.value)}><option value="en">English</option><option value="ml">മലയാളം</option></select></label>;
}
