import {useTranslation} from 'react-i18next';
import {uiText} from '../uiText';
import './language-select.css';
export function LanguageSelect(){
 const {i18n}=useTranslation(undefined,{bindI18n:'languageChanged loaded'});
 const malayalam=i18n.language.startsWith('ml');
 return <div className="ae-language-select ae-language-switch" role="group" aria-label={uiText('Language')}>
  <button type="button" lang="en" aria-pressed={!malayalam} onClick={()=>void i18n.changeLanguage('en')}>English</button>
  <button type="button" lang="ml" aria-pressed={malayalam} onClick={()=>void i18n.changeLanguage('ml')}>മലയാളം</button>
 </div>;
}
