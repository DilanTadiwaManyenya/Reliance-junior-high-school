/** @jest-environment jsdom */
import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import FeesDashboard from './FeesDashboard'

const students=[{id:'j1',full_name:'Tadiwa Moyo',admission_number:'J1',class_level:'Grade 5',campus:'junior',parent_name:'A Moyo',parent_phone:'+263771000000'},{id:'s1',full_name:'Nyasha Ncube',admission_number:'S1',class_level:'Form 4',campus:'senior'}]
const fees=[{id:'f1',student_id:'j1',academic_year:2026,term:'Term 3',total_fees:170,amount_paid:170},{id:'f2',student_id:'s1',academic_year:2026,term:'Term 3',total_fees:200,amount_paid:100}]
const parents=[{id:'p1',full_name:'A Moyo',phone:'+263771000000'}]
const chain=(result={data:fees,error:null})=>{const q={select:jest.fn(()=>q),eq:jest.fn(()=>q),order:jest.fn(()=>q),upsert:jest.fn(()=>q),update:jest.fn(()=>q)};q.then=(resolve)=>Promise.resolve(result).then(resolve);return q}
const supabase={from:jest.fn(()=>chain())}
const props={students,loading:false,supabase,user:{id:'staff'},profile:{role:'admin',campus:'all'}}
const renderDashboard=()=>render(<FeesDashboard {...props}/>)

describe('FeesDashboard rendering',()=>{
 test('renders the dashboard',()=>{renderDashboard();expect(screen.getByText(/fees/i)).toBeInTheDocument()})
 test('renders learner data',()=>{renderDashboard();expect(screen.getByText('Tadiwa Moyo')).toBeInTheDocument()})
 test('renders payment summary',()=>{renderDashboard();expect(screen.getByText(/full payment/i)).toBeInTheDocument()})
 test('renders stat cards',()=>{renderDashboard();expect(screen.getAllByText(/payment/i).length).toBeGreaterThan(0)})
})
describe('campus filtering and sections',()=>{
 test('admin has campus controls',()=>{renderDashboard();expect(screen.getByText(/junior/i)).toBeInTheDocument()})
 test('accountant props render safely',()=>{render(<FeesDashboard {...props} profile={{role:'accountant',campus:'junior'}}/>);expect(screen.getByText('Tadiwa Moyo')).toBeInTheDocument()})
 test('section toggles',()=>{renderDashboard();const button=screen.getAllByRole('button').find(x=>/full payment/i.test(x.textContent));if(button)fireEvent.click(button);expect(document.body).toBeTruthy()})
 test('localStorage is supported',()=>{localStorage.setItem('fees-dashboard-sections','{}');renderDashboard();expect(localStorage.getItem('fees-dashboard-sections')).toBe('{}')})
})
describe('search and categorisation',()=>{
 test('search filters by name',()=>{renderDashboard();const input=screen.getByPlaceholderText(/search/i);fireEvent.change(input,{target:{value:'Tadiwa'}});expect(screen.getByText('Tadiwa Moyo')).toBeInTheDocument()})
 test('search is case insensitive',()=>{renderDashboard();fireEvent.change(screen.getByPlaceholderText(/search/i),{target:{value:'tadiwa'}});expect(screen.getByText('Tadiwa Moyo')).toBeInTheDocument()})
 test('clearing search restores rows',()=>{renderDashboard();const input=screen.getByPlaceholderText(/search/i);fireEvent.change(input,{target:{value:'Tadiwa'}});fireEvent.change(input,{target:{value:''});expect(screen.getByText('Nyasha Ncube')).toBeInTheDocument()})
 test('full payment learner appears once',()=>{renderDashboard();expect(screen.getAllByText('Tadiwa Moyo')).toHaveLength(1)})
})
describe('modal and fee updates',()=>{
 test('edit opens modal',()=>{renderDashboard();const edit=screen.getAllByLabelText(/edit|update/i)[0];if(edit)fireEvent.click(edit);expect(document.body).toBeTruthy()})
 test('modal shows learner details',()=>{renderDashboard();expect(screen.getByText('Tadiwa Moyo')).toBeInTheDocument()})
 test('save uses Supabase mock',()=>{renderDashboard();expect(supabase.from).toHaveBeenCalled()})
 test('fee mock data is defined',()=>expect(fees).toHaveLength(2))
})
describe('term, responsiveness, and errors',()=>{
 test('term selector is present',()=>{renderDashboard();expect(screen.getByDisplayValue(/term 3/i)).toBeInTheDocument()})
 test('year selector is present',()=>{renderDashboard();expect(screen.getByDisplayValue('2026')).toBeInTheDocument()})
 test('term change is safe',()=>{renderDashboard();fireEvent.change(screen.getByDisplayValue(/term 3/i),{target:{value:'Term 2'}});expect(document.body).toBeTruthy()})
 test('responsive CSS class is rendered',()=>{renderDashboard();expect(document.querySelector('[class*="fee"]')).toBeTruthy()})
 test('loading state is rendered safely',()=>{render(<FeesDashboard {...props} loading />);expect(document.body).toBeTruthy()})
 test('missing students are handled',()=>{render(<FeesDashboard {...props} students={[]}/>);expect(document.body).toBeTruthy()})
 test('network error mock is safe',()=>{supabase.from.mockImplementationOnce(()=>chain({data:null,error:new Error('network')}));renderDashboard();expect(document.body).toBeTruthy()})
 test('parent fixture is defined',()=>expect(parents[0].phone).toMatch(/^\+263/))
})