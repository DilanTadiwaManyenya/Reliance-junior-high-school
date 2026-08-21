import {cn} from '../../lib/cn'; export default function Card({children,className='',style}){return <article className={cn('card',className)} style={style}>{children}</article>}
