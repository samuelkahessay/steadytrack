'use client';

import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/toast';

const INTEREST_AREAS = [
  { id: 'testing', label: 'Student Feedback & Testing' },
  { id: 'content', label: 'Content Creation' },
  { id: 'subject', label: 'Subject-Specific Expertise' },
  { id: 'technical', label: 'Technical/Development' },
  { id: 'feedback', label: 'General Feedback & Ideas' },
  { id: 'other', label: 'Other' },
];

export default function ContributorForm() {
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    interestAreas: [] as string[],
  });

  const handleInterestToggle = (interestId: string) => {
    setFormData((prev) => {
      const isSelected = prev.interestAreas.includes(interestId);
      return {
        ...prev,
        interestAreas: isSelected
          ? prev.interestAreas.filter((id) => id !== interestId)
          : [...prev.interestAreas, interestId],
      };
    });
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      showToast('Please enter your name', 'error');
      return;
    }

    if (!formData.email.trim()) {
      showToast('Please enter your email', 'error');
      return;
    }

    if (!validateEmail(formData.email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    if (formData.interestAreas.length === 0) {
      showToast('Please select at least one interest area', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contribute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      showToast('Thanks for your interest! We\'ll reach out soon.', 'success');

      // Reset form
      setFormData({
        name: '',
        email: '',
        message: '',
        interestAreas: [],
      });
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Failed to submit. Please try again.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-16 bg-white">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Want to Help?
          </h2>
          <p className="text-lg text-gray-600">
            Fill out this form and we&apos;ll reach out to you about how you can contribute to helping Alberta students.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <Label htmlFor="name" className="text-gray-900 mb-2 block">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Your name"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-gray-900 mb-2 block">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your.email@example.com"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Interest Areas */}
          <div>
            <Label className="text-gray-900 mb-3 block">
              How would you like to help? <span className="text-red-500">*</span>
            </Label>
            <div className="space-y-3">
              {INTEREST_AREAS.map((area) => (
                <div key={area.id} className="flex items-center gap-3">
                  <Checkbox
                    id={area.id}
                    checked={formData.interestAreas.includes(area.id)}
                    onCheckedChange={() => handleInterestToggle(area.id)}
                    disabled={isSubmitting}
                  />
                  <Label
                    htmlFor={area.id}
                    className="text-gray-700 font-normal cursor-pointer"
                  >
                    {area.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Message */}
          <div>
            <Label htmlFor="message" className="text-gray-900 mb-2 block">
              Message (Optional)
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="Tell us more about how you'd like to help or any specific ideas you have..."
              disabled={isSubmitting}
              rows={5}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 text-lg font-semibold bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </div>
    </section>
  );
}
