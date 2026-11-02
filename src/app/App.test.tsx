import { render, screen } from '@testing-library/react';
import { App } from './App';
import pkg from '../../package.json';

describe('App', () => {
  it('renders the app name and the version from package.json', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'ASCEND' })).toBeInTheDocument();
    expect(screen.getByText(`Version ${pkg.version}`)).toBeInTheDocument();
  });
});
